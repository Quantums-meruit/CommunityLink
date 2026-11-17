
import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { Readable } from "node:stream";

// Cloudinary stores uploaded profile images outside our application server.
import cloudinary, { isCloudinaryConfigured } from "../config/cloudinary.js";

// Multer validates incoming image files and temporarily holds them in memory.
import { uploadProfileImage } from "../middleware/uploadMiddleware.js";

// Database models used by the API routes.
import User from "../models/User.js";
import Community from "../models/Community.js";
import Membership from "../models/Membership.js";
import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import Event from "../models/Event.js";
import EventRegistration from "../models/EventRegistration.js";
import Business from "../models/Business.js";
import Opportunity from "../models/Opportunity.js";
import Application from "../models/Application.js";
import Report from "../models/Report.js";
import Notification from "../models/Notification.js";

// Authentication, authorization and token utilities.
import tokenFor from "../utils/generateToken.js";
import {
  protect,
  optionalAuth,
} from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/roleMiddleware.js";

// -----------------------------------------------------------------------------
// ROUTER AND SHARED API HELPERS
// -----------------------------------------------------------------------------

const router = Router();

/*
 * asyncRoute forwards errors from asynchronous route handlers to Express's
 * central error handler. This avoids repeating try/catch blocks in every route.
 */
const asyncRoute = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Standard success response used throughout the CommunityLink API.
const ok = (res, data, status = 200) =>
  res.status(status).json({ success: true, data });

// Standard error response for expected client and permission errors.
const fail = (res, status, message) =>
  res.status(status).json({ success: false, message });

// Validate MongoDB document IDs before querying by ID.
const id = (value) => mongoose.isValidObjectId(value);

/*
 * Store the authentication token in an HTTP-only cookie.
 * HTTP-only prevents frontend JavaScript from directly reading the token.
 */
const cookie = (res, token) =>
  res.cookie(
    process.env.COOKIE_NAME || "communitylink_token",
    token,
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.COOKIE_SAME_SITE ||
        (process.env.NODE_ENV === "production" ? "none" : "lax"),
      maxAge: 86400000,
      path: "/",
    }
  );

// Remove the authentication cookie when a user logs out.
const clearCookie = (res) =>
  res.clearCookie(
    process.env.COOKIE_NAME || "communitylink_token",
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.COOKIE_SAME_SITE ||
        (process.env.NODE_ENV === "production" ? "none" : "lax"),
      path: "/",
    }
  );

// Limit repeated authentication attempts to reduce brute-force attacks.
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Try again later.",
  },
});

// Limit repeated reports to reduce abuse of the reporting endpoint.
const reportLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Report rate limit reached. Try again later.",
  },
});

// Escape user-provided search text before using it in a MongoDB regular expression.
const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/*
 * Shared pagination helper.
 * It returns a consistent structure containing the requested records
 * and pagination metadata, so frontend pages can reuse the same approach.
 */
const page = async (Model, filter, req, populate) => {
  const pageNum = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

  let query = Model.find(filter)
    .sort({ createdAt: -1 })
    .skip((pageNum - 1) * limit)
    .limit(limit);

  if (populate) {
    query = query.populate(populate);
  }

  const [data, total] = await Promise.all([
    query,
    Model.countDocuments(filter),
  ]);

  return {
    items: data,
    pagination: {
      page: pageNum,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// Check whether the authenticated user has the global administrator role.
const isAdmin = (req) => req.user?.globalRole === "admin";

// Find an active membership connecting a user to a community.
const member = async (userId, communityId) =>
  Membership.findOne({
    user: userId,
    community: communityId,
    status: "active",
  });

/*
 * Community owners and moderators can manage their communities.
 * Global administrators can also manage any community.
 */
const manager = async (req, communityId) => {
  if (isAdmin(req)) {
    return true;
  }

  const membership = await member(req.user._id, communityId);

  return (
    !!membership &&
    ["owner", "moderator"].includes(membership.role)
  );
};

// Create an in-app notification for another user.
const notify = async (
  recipient,
  type,
  message,
  resourceType,
  resourceId
) =>
  Notification.create({
    recipient,
    type,
    message,
    resourceType,
    resourceId,
  });

// -----------------------------------------------------------------------------
// 1. AUTHENTICATION AND USER PROFILES
// -----------------------------------------------------------------------------

// Register a new user, hash their password and create an authenticated session.
router.post(
  "/auth/register",
  authLimit,
  asyncRoute(async (req, res) => {
    const { name, email, password } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !/^\S+@\S+\.\S+$/.test(email) ||
      typeof password !== "string" ||
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return fail(
        res,
        400,
        "Name, valid email and password (at least 8 characters) are required."
      );
    }

    const normalized = email.toLowerCase().trim();

    if (await User.exists({ email: normalized })) {
      return fail(res, 409, "An account with this email already exists.");
    }

    const user = await User.create({
      name: name.trim(),
      email: normalized,
      password: await bcrypt.hash(password, 12),
    });

    cookie(res, tokenFor(user));

    ok(
      res,
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          globalRole: user.globalRole,
        },
      },
      201
    );
  })
);

// Authenticate an existing user using their email and password.
router.post(
  "/auth/login",
  authLimit,
  asyncRoute(async (req, res) => {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email ||
      !password
    ) {
      return fail(res, 400, "Email and password are required.");
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    }).select("+password");

    if (
      !user ||
      !user.isActive ||
      !(await bcrypt.compare(password, user.password))
    ) {
      return fail(res, 401, "Invalid email or password.");
    }

    cookie(res, tokenFor(user));

    ok(res, {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        globalRole: user.globalRole,
      },
    });
  })
);

// Log out by clearing the authentication cookie.
router.post("/auth/logout", (req, res) => {
  clearCookie(res);
  ok(res, { message: "Logged out successfully." });
});

// Return basic information about the currently authenticated user.
router.get(
  "/auth/me",
  protect,
  asyncRoute(async (req, res) =>
    ok(res, {
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        globalRole: req.user.globalRole,
      },
    })
  )
);

// Retrieve the authenticated user's complete profile, excluding their password.
router.get(
  "/users/me",
  protect,
  asyncRoute(async (req, res) =>
    ok(res, {
      user: await User.findById(req.user.id).select("-password"),
    })
  )
);

// Update editable profile details using JSON request data.
router.patch(
  "/users/me",
  protect,
  asyncRoute(async (req, res) => {
    // Only these fields are permitted through this profile update endpoint.
    const allowed = {
      name: 1,
      bio: 1,
      location: 1,
      avatar: 1,
    };

    const update = {};

    for (const key of Object.keys(allowed)) {
      if (req.body[key] !== undefined) {
        update[key] = req.body[key];
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      update,
      { new: true, runValidators: true }
    ).select("-password");

    ok(res, { user });
  })
);

/*
 * Upload or replace the authenticated user's profile photo.
 *
 * Endpoint: POST /api/v1/users/me/avatar
 * Authentication: Required
 * Content-Type: multipart/form-data
 * File field: avatar
 *
 * Multer processes the uploaded file before this handler runs.
 * Cloudinary stores the image, while MongoDB stores its secure URL.
 */
router.post(
  "/users/me/avatar",
  protect,
  uploadProfileImage,
  asyncRoute(async (req, res) => {
    // Reject requests that do not contain the expected image file.
    if (!req.file) {
      return fail(res, 400, "Please select an image to upload.");
    }

    // Check configuration only when a profile image upload is requested.
    if (!isCloudinaryConfigured) {
      return fail(res, 503, "Profile image uploads are temporarily unavailable.");
    }

    /*
     * Send the in-memory image buffer to Cloudinary.
     * Using the user's ID as public_id replaces their previous profile image
     * instead of creating a different Cloudinary asset on every upload.
     */
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "communitylink/profiles",
          public_id: String(req.user.id),
          overwrite: true,
          resource_type: "image",
        },
        (error, result) => {
          if (error) {
            return reject(error);
          }

          return resolve(result);
        }
      );

      // Convert the Multer buffer into a readable stream for Cloudinary.
      Readable.from(req.file.buffer).pipe(uploadStream);
    });

    // Do not save an invalid or missing Cloudinary response to the database.
    if (!uploadResult?.secure_url) {
      throw new Error("Cloudinary did not return a secure image URL.");
    }

    // Save the new image URL to the authenticated user's MongoDB profile.
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { avatar: uploadResult.secure_url },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return fail(res, 404, "User account not found.");
    }

    // Return the updated profile using the standard API response format.
    return ok(res, { user });
  })
);

// -----------------------------------------------------------------------------
// 2. COMMUNITIES AND MEMBERSHIP
// -----------------------------------------------------------------------------

// Browse active communities with optional category and search filters.
router.get(
  "/communities",
  optionalAuth,
  asyncRoute(async (req, res) => {
    const filterBase = {
      status: "active",
      ...(req.query.category
        ? { category: req.query.category }
        : {}),
      ...(req.query.search
        ? {
            $or: [
              {
                name: {
                  $regex: escapeRegex(req.query.search),
                  $options: "i",
                },
              },
              {
                description: {
                  $regex: escapeRegex(req.query.search),
                  $options: "i",
                },
              },
            ],
          }
        : {}),
    };

    // Private communities are not shown to unauthenticated visitors.
    const visibilityFilter = !req.user
      ? { visibility: "public" }
      : {
          $or: [
            { visibility: "public" },
            { owner: req.user.id },
          ],
        };

    const filter = { ...filterBase, ...visibilityFilter };

    // Combine the search and visibility conditions without overwriting either.
    if (filterBase.$or && visibilityFilter.$or) {
      filter.$and = [
        { $or: filterBase.$or },
        visibilityFilter,
      ];
    }

    delete filter.$or;

    ok(
      res,
      await page(Community, filter, req, {
        path: "owner",
        select: "name",
      })
    );
  })
);

// Create a community and automatically make its creator the owner.
router.post(
  "/communities",
  protect,
  asyncRoute(async (req, res) => {
    const {
      name,
      description,
      category,
      visibility = "public",
      image,
    } = req.body;

    if (!name || !description || !category) {
      return fail(res, 400, "Name, description and category are required.");
    }

    // Generate a readable URL slug and add a short suffix to reduce collisions.
    const slug =
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" +
      Math.random().toString(36).slice(2, 7);

    const community = await Community.create({
      name,
      slug,
      description,
      category,
      visibility,
      image,
      owner: req.user.id,
    });

    // The creator receives an active owner membership immediately.
    await Membership.create({
      user: req.user.id,
      community: community.id,
      role: "owner",
      status: "active",
      joinedAt: new Date(),
    });

    ok(res, { community }, 201);
  })
);

// Retrieve one community, enforcing its visibility rules.
router.get(
  "/communities/:id",
  optionalAuth,
  asyncRoute(async (req, res) => {
    if (!id(req.params.id)) {
      return fail(res, 400, "Invalid community ID.");
    }

    const community = await Community.findById(
      req.params.id
    ).populate("owner", "name");

    if (!community || community.status !== "active") {
      return fail(res, 404, "Community not found.");
    }

    if (
      community.visibility === "private" &&
      (!req.user ||
        (!(await member(req.user.id, community.id)) && !isAdmin(req)))
    ) {
      return fail(
        res,
        403,
        "Join this private community to view its content."
      );
    }

    ok(res, {
      community,
      membership: req.user
        ? await member(req.user.id, community.id)
        : null,
    });
  })
);

// Update community details. Only the owner or an administrator may do this.
router.patch(
  "/communities/:id",
  protect,
  asyncRoute(async (req, res) => {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return fail(res, 404, "Community not found.");
    }

    if (
      community.owner.toString() !== req.user.id &&
      !isAdmin(req)
    ) {
      return fail(
        res,
        403,
        "Only the owner or an administrator can update this community."
      );
    }

    for (const key of [
      "name",
      "description",
      "category",
      "visibility",
      "image",
    ]) {
      if (req.body[key] !== undefined) {
        community[key] = req.body[key];
      }
    }

    await community.save();
    ok(res, { community });
  })
);

// Archive a community by changing its status rather than deleting its record.
router.delete(
  "/communities/:id",
  protect,
  asyncRoute(async (req, res) => {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return fail(res, 404, "Community not found.");
    }

    if (
      community.owner.toString() !== req.user.id &&
      !isAdmin(req)
    ) {
      return fail(res, 403, "Not authorized.");
    }

    community.status = "suspended";
    await community.save();

    ok(res, { message: "Community archived." });
  })
);

// Join a public community or request membership in a private community.
router.post(
  "/communities/:id/join",
  protect,
  asyncRoute(async (req, res) => {
    const community = await Community.findById(req.params.id);

    if (!community || community.status !== "active") {
      return fail(res, 404, "Community not found.");
    }

    let membership = await Membership.findOne({
      user: req.user.id,
      community: community.id,
    });

    if (membership?.status === "banned") {
      return fail(res, 403, "You are banned from this community.");
    }

    if (membership?.status === "active") {
      return ok(res, {
        membership,
        message: "Already a member.",
      });
    }

    if (membership) {
      membership.status =
        community.visibility === "private" ? "pending" : "active";

      membership.joinedAt =
        membership.status === "active" ? new Date() : undefined;

      await membership.save();
    } else {
      membership = await Membership.create({
        user: req.user.id,
        community: community.id,
        status:
          community.visibility === "private" ? "pending" : "active",
        joinedAt:
          community.visibility === "public" ? new Date() : undefined,
      });
    }

    // Notify the community owner when someone requests access to a private group.
    if (community.visibility === "private") {
      await notify(
        community.owner,
        "membership_request",
        `${req.user.name} requested to join ${community.name}.`,
        "community",
        community.id
      );
    }

    ok(res, { membership }, 201);
  })
);

// Leave a community. Owners must transfer ownership before leaving.
router.post(
  "/communities/:id/leave",
  protect,
  asyncRoute(async (req, res) => {
    const membership = await Membership.findOne({
      user: req.user.id,
      community: req.params.id,
      status: "active",
    });

    if (!membership) {
      return fail(res, 404, "Active membership not found.");
    }

    if (membership.role === "owner") {
      return fail(
        res,
        400,
        "Transfer ownership before leaving this community."
      );
    }

    membership.status = "rejected";
    await membership.save();

    ok(res, { message: "You left the community." });
  })
);

// List community members. Membership or administrator access is required.
router.get(
  "/communities/:id/members",
  protect,
  asyncRoute(async (req, res) => {
    if (
      !(await member(req.user.id, req.params.id)) &&
      !isAdmin(req)
    ) {
      return fail(res, 403, "Membership required.");
    }

    ok(res, {
      members: await Membership.find({
        community: req.params.id,
        status: { $in: ["active", "pending"] },
      }).populate("user", "name email avatar"),
    });
  })
);

// Allow community managers to approve, reject, ban or change member roles.
router.patch(
  "/communities/:id/members/:userId",
  protect,
  asyncRoute(async (req, res) => {
    if (!(await manager(req, req.params.id))) {
      return fail(res, 403, "Community manager access required.");
    }

    const membership = await Membership.findOne({
      community: req.params.id,
      user: req.params.userId,
    });

    if (!membership) {
      return fail(res, 404, "Membership not found.");
    }

    const { status, role } = req.body;

    if (status && ["active", "rejected", "banned"].includes(status)) {
      membership.status = status;

      if (status === "active") {
        membership.joinedAt = new Date();
      }
    }

    if (role && ["moderator", "member"].includes(role)) {
      membership.role = role;
    }

    await membership.save();
    ok(res, { membership });
  })
);

// -----------------------------------------------------------------------------
// 3. COMMUNITY POSTS AND COMMENTS
// -----------------------------------------------------------------------------

// Retrieve published posts belonging to a community.
router.get(
  "/communities/:id/posts",
  optionalAuth,
  asyncRoute(async (req, res) => {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return fail(res, 404, "Community not found.");
    }

    if (
      community.visibility === "private" &&
      (!req.user ||
        (!(await member(req.user.id, community.id)) && !isAdmin(req)))
    ) {
      return fail(res, 403, "Membership required.");
    }

    ok(
      res,
      await page(
        Post,
        {
          community: community.id,
          status: "published",
        },
        req,
        {
          path: "author",
          select: "name avatar",
        }
      )
    );
  })
);

// Create a post. Active community membership is required.
router.post(
  "/communities/:id/posts",
  protect,
  asyncRoute(async (req, res) => {
    const membership = await member(req.user.id, req.params.id);

    if (!membership && !isAdmin(req)) {
      return fail(
        res,
        403,
        "Active community membership required."
      );
    }

    if (
      typeof req.body.content !== "string" ||
      !req.body.content.trim()
    ) {
      return fail(res, 400, "Post content is required.");
    }

    const post = await Post.create({
      community: req.params.id,
      author: req.user.id,
      content: req.body.content,
      image: req.body.image,
      visibility: req.body.visibility || "community",
    });

    ok(res, { post }, 201);
  })
);

// Retrieve one published post and its related community information.
router.get(
  "/posts/:id",
  optionalAuth,
  asyncRoute(async (req, res) => {
    const post = await Post.findOne({
      _id: req.params.id,
      status: "published",
    })
      .populate("author", "name avatar")
      .populate("community");

    if (!post) {
      return fail(res, 404, "Post not found.");
    }

    if (
      post.community.visibility === "private" &&
      (!req.user ||
        (!(await member(req.user.id, post.community.id)) && !isAdmin(req)))
    ) {
      return fail(res, 403, "Membership required.");
    }

    ok(res, { post });
  })
);

// Edit a post. Its author or a community manager may make changes.
router.patch(
  "/posts/:id",
  protect,
  asyncRoute(async (req, res) => {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return fail(res, 404, "Post not found.");
    }

    const allowed =
      post.author.toString() === req.user.id ||
      await manager(req, post.community);

    if (!allowed) {
      return fail(res, 403, "Not authorized.");
    }

    if (req.body.content !== undefined) {
      post.content = req.body.content;
    }

    if (req.body.image !== undefined) {
      post.image = req.body.image;
    }

    await post.save();
    ok(res, { post });
  })
);

// Remove a post by changing its status.
router.delete(
  "/posts/:id",
  protect,
  asyncRoute(async (req, res) => {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return fail(res, 404, "Post not found.");
    }

    if (
      post.author.toString() !== req.user.id &&
      !(await manager(req, post.community))
    ) {
      return fail(res, 403, "Not authorized.");
    }

    post.status = "removed";
    await post.save();

    ok(res, { message: "Post removed." });
  })
);

// Retrieve comments belonging to a published post.
router.get(
  "/posts/:id/comments",
  optionalAuth,
  asyncRoute(async (req, res) => {
    const post = await Post.findById(req.params.id).populate("community");

    if (!post || post.status !== "published") {
      return fail(res, 404, "Post not found.");
    }

    if (
      post.community.visibility === "private" &&
      (!req.user ||
        (!(await member(req.user.id, post.community.id)) && !isAdmin(req)))
    ) {
      return fail(res, 403, "Membership required.");
    }

    ok(res, {
      comments: await Comment.find({
        post: post.id,
        status: "published",
      })
        .populate("author", "name avatar")
        .sort({ createdAt: 1 }),
    });
  })
);

// Add a comment to a published post.
router.post(
  "/posts/:id/comments",
  protect,
  asyncRoute(async (req, res) => {
    const post = await Post.findById(req.params.id).populate("community");

    if (!post || post.status !== "published") {
      return fail(res, 404, "Post not found.");
    }

    if (
      post.community.visibility === "private" &&
      !(await member(req.user.id, post.community.id)) &&
      !isAdmin(req)
    ) {
      return fail(res, 403, "Membership required.");
    }

    if (
      typeof req.body.content !== "string" ||
      !req.body.content.trim()
    ) {
      return fail(res, 400, "Comment content is required.");
    }

    const comment = await Comment.create({
      post: post.id,
      author: req.user.id,
      content: req.body.content,
    });

    ok(res, { comment }, 201);
  })
);

// Edit a comment. The author or a community manager can edit it.
router.patch(
  "/comments/:id",
  protect,
  asyncRoute(async (req, res) => {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return fail(res, 404, "Comment not found.");
    }

    const post = await Post.findById(comment.post);

    if (
      comment.author.toString() !== req.user.id &&
      !(await manager(req, post.community))
    ) {
      return fail(res, 403, "Not authorized.");
    }

    comment.content = req.body.content ?? comment.content;

    await comment.save();
    ok(res, { comment });
  })
);

// Remove a comment without permanently deleting its database record.
router.delete(
  "/comments/:id",
  protect,
  asyncRoute(async (req, res) => {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return fail(res, 404, "Comment not found.");
    }

    const post = await Post.findById(comment.post);

    if (
      comment.author.toString() !== req.user.id &&
      !(await manager(req, post.community))
    ) {
      return fail(res, 403, "Not authorized.");
    }

    comment.status = "removed";
    await comment.save();

    ok(res, { message: "Comment removed." });
  })
);

// -----------------------------------------------------------------------------
// 4. EVENTS AND REGISTRATIONS
// -----------------------------------------------------------------------------

// Browse upcoming events. Private-community events are visible only to members.
router.get(
  "/events",
  optionalAuth,
  asyncRoute(async (req, res) => {
    const events = await Event.find({
      status: "upcoming",
      startsAt: { $gt: new Date() },
    })
      .populate("community", "name visibility")
      .sort({ startsAt: 1 })
      .limit(50);

    const memberships = req.user
      ? await Membership.find({
          user: req.user.id,
          status: "active",
        }).distinct("community")
      : [];

    const visible = events.filter(
      (event) =>
        event.community.visibility === "public" ||
        (req.user &&
          (isAdmin(req) ||
            memberships.some(
              (membershipId) =>
                membershipId.toString() === event.community.id
            )))
    );

    ok(res, { items: visible });
  })
);

// Retrieve events belonging to a specific community.
router.get(
  "/communities/:id/events",
  optionalAuth,
  asyncRoute(async (req, res) => {
    const community = await Community.findById(req.params.id);

    if (!community) {
      return fail(res, 404, "Community not found.");
    }

    if (
      community.visibility === "private" &&
      (!req.user ||
        (!(await member(req.user.id, community.id)) && !isAdmin(req)))
    ) {
      return fail(res, 403, "Membership required.");
    }

    ok(
      res,
      await page(
        Event,
        {
          community: community.id,
          status: "upcoming",
        },
        req
      )
    );
  })
);

// Create an event. Community owners and moderators have management access.
router.post(
  "/communities/:id/events",
  protect,
  asyncRoute(async (req, res) => {
    if (!(await manager(req, req.params.id))) {
      return fail(res, 403, "Community manager access required.");
    }

    const {
      title,
      description,
      startsAt,
      endsAt,
      capacity,
      venue,
    } = req.body;

    if (
      !title ||
      !description ||
      !startsAt ||
      !endsAt ||
      new Date(endsAt) <= new Date(startsAt) ||
      (capacity !== undefined && Number(capacity) < 1)
    ) {
      return fail(
        res,
        400,
        "Valid event details, dates and capacity are required."
      );
    }

    const event = await Event.create({
      community: req.params.id,
      createdBy: req.user.id,
      title,
      description,
      startsAt,
      endsAt,
      capacity,
      venue,
    });

    ok(res, { event }, 201);
  })
);

// Retrieve event details, enforcing private-community access.
router.get(
  "/events/:id",
  optionalAuth,
  asyncRoute(async (req, res) => {
    const event = await Event.findById(req.params.id)
      .populate("community")
      .populate("createdBy", "name");

    if (!event) {
      return fail(res, 404, "Event not found.");
    }

    if (
      event.community.visibility === "private" &&
      (!req.user ||
        (!(await member(req.user.id, event.community.id)) && !isAdmin(req)))
    ) {
      return fail(res, 403, "Membership required.");
    }

    ok(res, { event });
  })
);

// Update an event. Its creator or a community manager may edit it.
router.patch(
  "/events/:id",
  protect,
  asyncRoute(async (req, res) => {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return fail(res, 404, "Event not found.");
    }

    if (
      event.createdBy.toString() !== req.user.id &&
      !(await manager(req, event.community))
    ) {
      return fail(res, 403, "Not authorized.");
    }

    for (const key of [
      "title",
      "description",
      "startsAt",
      "endsAt",
      "capacity",
      "venue",
      "status",
    ]) {
      if (req.body[key] !== undefined) {
        event[key] = req.body[key];
      }
    }

    if (event.endsAt <= event.startsAt) {
      return fail(res, 400, "Event end must be after start.");
    }

    await event.save();
    ok(res, { event });
  })
);

// Cancel an event by updating its status.
router.delete(
  "/events/:id",
  protect,
  asyncRoute(async (req, res) => {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return fail(res, 404, "Event not found.");
    }

    if (
      event.createdBy.toString() !== req.user.id &&
      !(await manager(req, event.community))
    ) {
      return fail(res, 403, "Not authorized.");
    }

    event.status = "cancelled";
    await event.save();

    ok(res, { message: "Event cancelled." });
  })
);

// Register an eligible user for an upcoming event.
router.post(
  "/events/:id/register",
  protect,
  asyncRoute(async (req, res) => {
    const event = await Event.findById(req.params.id);

    if (
      !event ||
      event.status !== "upcoming" ||
      event.startsAt <= new Date()
    ) {
      return fail(
        res,
        400,
        "This event is not accepting registrations."
      );
    }

    if (
      !(await member(req.user.id, event.community)) &&
      !isAdmin(req)
    ) {
      return fail(
        res,
        403,
        "Active community membership required."
      );
    }

    const existing = await EventRegistration.findOne({
      event: event.id,
      user: req.user.id,
    });

    if (existing && existing.status !== "cancelled") {
      return fail(
        res,
        409,
        "You are already registered or have attended this event."
      );
    }

    /*
     * Atomically increment the registration count only when capacity
     * is still available. This helps prevent overbooking.
     */
    const reservation = await Event.findOneAndUpdate(
      {
        _id: event.id,
        status: "upcoming",
        ...(event.capacity
          ? { registeredCount: { $lt: event.capacity } }
          : {}),
      },
      { $inc: { registeredCount: 1 } },
      { new: true }
    );

    if (!reservation) {
      return fail(
        res,
        409,
        "Event capacity has been reached or registration is closed."
      );
    }

    try {
      let registration;

      if (existing) {
        registration = await EventRegistration.findOneAndUpdate(
          {
            _id: existing.id,
            status: "cancelled",
          },
          {
            $set: {
              status: "registered",
              registeredAt: new Date(),
            },
          },
          { new: true }
        );

        if (!registration) {
          // Reverse the count if the registration could not be restored.
          await Event.updateOne(
            { _id: event.id },
            { $inc: { registeredCount: -1 } }
          );

          return fail(
            res,
            409,
            "Registration state changed. Refresh and try again."
          );
        }
      } else {
        registration = await EventRegistration.create({
          event: event.id,
          user: req.user.id,
        });
      }

      ok(res, { registration }, 201);
    } catch (error) {
      // Roll back the reserved slot if registration creation fails.
      await Event.updateOne(
        { _id: event.id },
        { $inc: { registeredCount: -1 } }
      );

      if (error.code === 11000) {
        return fail(res, 409, "You are already registered.");
      }

      throw error;
    }
  })
);

// Cancel the authenticated user's active event registration.
router.delete(
  "/events/:id/register",
  protect,
  asyncRoute(async (req, res) => {
    const registration = await EventRegistration.findOneAndUpdate(
      {
        event: req.params.id,
        user: req.user.id,
        status: "registered",
      },
      { $set: { status: "cancelled" } },
      { new: true }
    );

    if (!registration) {
      return fail(res, 404, "Active registration not found.");
    }

    // Decrease the event's registration count when a place is released.
    await Event.updateOne(
      {
        _id: req.params.id,
        registeredCount: { $gt: 0 },
      },
      { $inc: { registeredCount: -1 } }
    );

    ok(res, { message: "Registration cancelled." });
  })
);

// List event registrations. Only the creator or a community manager may view.
router.get(
  "/events/:id/registrations",
  protect,
  asyncRoute(async (req, res) => {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return fail(res, 404, "Event not found.");
    }

    if (
      event.createdBy.toString() !== req.user.id &&
      !(await manager(req, event.community))
    ) {
      return fail(res, 403, "Not authorized.");
    }

    ok(res, {
      registrations: await EventRegistration.find({
        event: event.id,
        status: "registered",
      }).populate("user", "name email"),
    });
  })
);

// -----------------------------------------------------------------------------
// 5. BUSINESS DIRECTORY
// -----------------------------------------------------------------------------

// Browse approved business listings with optional search and category filters.
router.get(
  "/businesses",
  asyncRoute(async (req, res) => {
    const filter = {
      status: "approved",
      ...(req.query.category
        ? { category: req.query.category }
        : {}),
      ...(req.query.search
        ? {
            $or: [
              {
                name: {
                  $regex: escapeRegex(req.query.search),
                  $options: "i",
                },
              },
              {
                description: {
                  $regex: escapeRegex(req.query.search),
                  $options: "i",
                },
              },
            ],
          }
        : {}),
    };

    ok(res, await page(Business, filter, req));
  })
);

// Submit a business listing for approval.
router.post(
  "/businesses",
  protect,
  asyncRoute(async (req, res) => {
    const { name, description, category } = req.body;

    if (!name || !description || !category) {
      return fail(res, 400, "Name, description and category are required.");
    }

    const business = await Business.create({
      ...req.body,
      createdBy: req.user.id,
      status: "pending",
    });

    ok(res, { business }, 201);
  })
);

// Retrieve an approved business listing.
router.get(
  "/businesses/:id",
  asyncRoute(async (req, res) => {
    const business = await Business.findOne({
      _id: req.params.id,
      status: "approved",
    });

    if (!business) {
      return fail(res, 404, "Business not found.");
    }

    ok(res, { business });
  })
);

// Update a business listing. Non-admin edits return the listing to pending review.
router.patch(
  "/businesses/:id",
  protect,
  asyncRoute(async (req, res) => {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return fail(res, 404, "Business not found.");
    }

    if (
      business.createdBy.toString() !== req.user.id &&
      !isAdmin(req)
    ) {
      return fail(res, 403, "Not authorized.");
    }

    for (const key of [
      "name",
      "description",
      "category",
      "location",
      "contactEmail",
      "phone",
      "website",
      "image",
    ]) {
      if (req.body[key] !== undefined) {
        business[key] = req.body[key];
      }
    }

    if (!isAdmin(req)) {
      business.status = "pending";
    }

    await business.save();
    ok(res, { business });
  })
);

// Remove a business listing by suspending it.
router.delete(
  "/businesses/:id",
  protect,
  asyncRoute(async (req, res) => {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return fail(res, 404, "Business not found.");
    }

    if (
      business.createdBy.toString() !== req.user.id &&
      !isAdmin(req)
    ) {
      return fail(res, 403, "Not authorized.");
    }

    business.status = "suspended";
    await business.save();

    ok(res, { message: "Listing removed." });
  })
);

// Allow administrators to approve or change a business listing's status.
router.patch(
  "/businesses/:id/status",
  protect,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const business = await Business.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );

    if (!business) {
      return fail(res, 404, "Business not found.");
    }

    ok(res, { business });
  })
);

// -----------------------------------------------------------------------------
// 6. OPPORTUNITIES AND APPLICATIONS
// -----------------------------------------------------------------------------

// Browse published opportunities while respecting private-community access.
router.get(
  "/opportunities",
  optionalAuth,
  asyncRoute(async (req, res) => {
    const filter = {
      status: "published",
      ...(req.query.category
        ? { category: req.query.category }
        : {}),
      ...(req.query.search
        ? {
            $or: [
              {
                title: {
                  $regex: escapeRegex(req.query.search),
                  $options: "i",
                },
              },
              {
                description: {
                  $regex: escapeRegex(req.query.search),
                  $options: "i",
                },
              },
            ],
          }
        : {}),
    };

    const rows = await page(Opportunity, filter, req);

    if (!req.user) {
      rows.items = rows.items.filter((item) => !item.community);
    } else {
      const memberships = await Membership.find({
        user: req.user.id,
        status: "active",
      }).distinct("community");

      rows.items = rows.items.filter(
        (item) =>
          !item.community ||
          memberships.some(
            (membershipId) =>
              membershipId.toString() === item.community.toString()
          )
      );
    }

    ok(res, rows);
  })
);

// Publish an opportunity. Community-linked opportunities require manager access.
router.post(
  "/opportunities",
  protect,
  asyncRoute(async (req, res) => {
    const { title, description, category } = req.body;

    if (!title || !description || !category) {
      return fail(
        res,
        400,
        "Title, description and category are required."
      );
    }

    if (
      req.body.community &&
      !(await manager(req, req.body.community))
    ) {
      return fail(res, 403, "Community manager access required.");
    }

    const opportunity = await Opportunity.create({
      ...req.body,
      createdBy: req.user.id,
      status: "published",
    });

    ok(res, { opportunity }, 201);
  })
);

// Retrieve opportunity details and enforce community membership if required.
router.get(
  "/opportunities/:id",
  optionalAuth,
  asyncRoute(async (req, res) => {
    const opportunity = await Opportunity.findById(
      req.params.id
    ).populate("createdBy", "name");

    if (!opportunity || opportunity.status !== "published") {
      return fail(res, 404, "Opportunity not found.");
    }

    if (
      opportunity.community &&
      (!req.user ||
        !(await member(req.user.id, opportunity.community)) &&
        !isAdmin(req))
    ) {
      return fail(res, 403, "Community membership required.");
    }

    ok(res, { opportunity });
  })
);

// Edit an opportunity. Its creator or an administrator may make changes.
router.patch(
  "/opportunities/:id",
  protect,
  asyncRoute(async (req, res) => {
    const opportunity = await Opportunity.findById(req.params.id);

    if (!opportunity) {
      return fail(res, 404, "Opportunity not found.");
    }

    if (
      opportunity.createdBy.toString() !== req.user.id &&
      !isAdmin(req)
    ) {
      return fail(res, 403, "Not authorized.");
    }

    for (const key of [
      "title",
      "description",
      "category",
      "organization",
      "deadline",
      "applicationInstructions",
      "status",
    ]) {
      if (req.body[key] !== undefined) {
        opportunity[key] = req.body[key];
      }
    }

    await opportunity.save();
    ok(res, { opportunity });
  })
);

// Remove an opportunity without permanently deleting its record.
router.delete(
  "/opportunities/:id",
  protect,
  asyncRoute(async (req, res) => {
    const opportunity = await Opportunity.findById(req.params.id);

    if (!opportunity) {
      return fail(res, 404, "Opportunity not found.");
    }

    if (
      opportunity.createdBy.toString() !== req.user.id &&
      !isAdmin(req)
    ) {
      return fail(res, 403, "Not authorized.");
    }

    opportunity.status = "removed";
    await opportunity.save();

    ok(res, { message: "Opportunity removed." });
  })
);

// Submit an application to an open opportunity.
router.post(
  "/opportunities/:id/applications",
  protect,
  asyncRoute(async (req, res) => {
    const opportunity = await Opportunity.findById(req.params.id);

    if (
      !opportunity ||
      opportunity.status !== "published" ||
      (opportunity.deadline && opportunity.deadline < new Date())
    ) {
      return fail(
        res,
        400,
        "Opportunity is closed to applications."
      );
    }

    if (opportunity.createdBy.toString() === req.user.id) {
      return fail(
        res,
        400,
        "You cannot apply to your own opportunity."
      );
    }

    if (
      opportunity.community &&
      !(await member(req.user.id, opportunity.community))
    ) {
      return fail(res, 403, "Community membership required.");
    }

    if (
      await Application.exists({
        opportunity: opportunity.id,
        applicant: req.user.id,
      })
    ) {
      return fail(res, 409, "You have already applied.");
    }

    const application = await Application.create({
      opportunity: opportunity.id,
      applicant: req.user.id,
      message: req.body.message,
    });

    await notify(
      opportunity.createdBy,
      "new_application",
      `${req.user.name} applied for ${opportunity.title}.`,
      "opportunity",
      opportunity.id
    );

    ok(res, { application }, 201);
  })
);

// Retrieve applications submitted by the authenticated user.
router.get(
  "/applications/me",
  protect,
  asyncRoute(async (req, res) =>
    ok(res, {
      applications: await Application.find({
        applicant: req.user.id,
      })
        .populate("opportunity", "title organization status")
        .sort({ createdAt: -1 }),
    })
  )
);

// Allow an opportunity owner or administrator to view applications.
router.get(
  "/opportunities/:id/applications",
  protect,
  asyncRoute(async (req, res) => {
    const opportunity = await Opportunity.findById(req.params.id);

    if (!opportunity) {
      return fail(res, 404, "Opportunity not found.");
    }

    if (
      opportunity.createdBy.toString() !== req.user.id &&
      !isAdmin(req)
    ) {
      return fail(res, 403, "Not authorized.");
    }

    ok(res, {
      applications: await Application.find({
        opportunity: opportunity.id,
      }).populate("applicant", "name email"),
    });
  })
);

// Update an application and notify the applicant of the decision.
router.patch(
  "/applications/:id/status",
  protect,
  asyncRoute(async (req, res) => {
    const application = await Application.findById(
      req.params.id
    ).populate("opportunity");

    if (!application) {
      return fail(res, 404, "Application not found.");
    }

    if (
      application.opportunity.createdBy.toString() !== req.user.id &&
      !isAdmin(req)
    ) {
      return fail(res, 403, "Not authorized.");
    }

    if (
      !["reviewing", "accepted", "rejected"].includes(req.body.status)
    ) {
      return fail(res, 400, "Invalid application status.");
    }

    application.status = req.body.status;
    await application.save();

    await notify(
      application.applicant,
      "application_update",
      `Your application status is now ${application.status}.`,
      "application",
      application.id
    );

    ok(res, { application });
  })
);

// -----------------------------------------------------------------------------
// 7. REPORTS, NOTIFICATIONS AND ADMINISTRATION
// -----------------------------------------------------------------------------

// Report a published post for moderation review.
router.post(
  "/posts/:id/reports",
  protect,
  reportLimit,
  asyncRoute(async (req, res) => {
    const target = await Post.findById(req.params.id);

    if (!target || target.status !== "published") {
      return fail(res, 404, "Post not found.");
    }

    const report = await Report.create({
      reporter: req.user.id,
      targetType: "post",
      targetId: target.id,
      reason: req.body.reason || "Inappropriate content",
      details: req.body.details,
    });

    ok(res, { report }, 201);
  })
);

// Report a published comment for moderation review.
router.post(
  "/comments/:id/reports",
  protect,
  reportLimit,
  asyncRoute(async (req, res) => {
    const target = await Comment.findById(req.params.id);

    if (!target || target.status !== "published") {
      return fail(res, 404, "Comment not found.");
    }

    const report = await Report.create({
      reporter: req.user.id,
      targetType: "comment",
      targetId: target.id,
      reason: req.body.reason || "Inappropriate content",
      details: req.body.details,
    });

    ok(res, { report }, 201);
  })
);

// General reporting endpoint for supported platform content.
router.post(
  "/reports",
  protect,
  reportLimit,
  asyncRoute(async (req, res) => {
    const { targetType, targetId, reason, details } = req.body;

    const models = {
      user: User,
      post: Post,
      comment: Comment,
      business: Business,
      opportunity: Opportunity,
    };

    if (!models[targetType] || !id(targetId) || !reason) {
      return fail(
        res,
        400,
        "Valid report target and reason are required."
      );
    }

    if (!(await models[targetType].exists({ _id: targetId }))) {
      return fail(res, 404, "Reported content not found.");
    }

    // Prevent the same user from repeatedly reporting the same target.
    const recent = await Report.exists({
      reporter: req.user.id,
      targetType,
      targetId,
      createdAt: {
        $gte: new Date(Date.now() - 3600000),
      },
    });

    if (recent) {
      return fail(
        res,
        429,
        "You have already reported this item recently."
      );
    }

    const report = await Report.create({
      reporter: req.user.id,
      targetType,
      targetId,
      reason,
      details,
    });

    ok(res, { report }, 201);
  })
);

// Retrieve notifications belonging only to the authenticated user.
router.get(
  "/notifications",
  protect,
  asyncRoute(async (req, res) =>
    ok(res, {
      notifications: await Notification.find({
        recipient: req.user.id,
      })
        .sort({ createdAt: -1 })
        .limit(50),
    })
  )
);

// Mark one notification as read, ensuring it belongs to the current user.
router.patch(
  "/notifications/:id/read",
  protect,
  asyncRoute(async (req, res) => {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: req.user.id,
      },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return fail(res, 404, "Notification not found.");
    }

    ok(res, { notification });
  })
);

// Mark all unread notifications belonging to the current user as read.
router.patch(
  "/notifications/read-all",
  protect,
  asyncRoute(async (req, res) => {
    await Notification.updateMany(
      {
        recipient: req.user.id,
        isRead: false,
      },
      { isRead: true }
    );

    ok(res, { message: "Notifications marked as read." });
  })
);

// Return high-level platform statistics for the administrator dashboard.
router.get(
  "/admin/dashboard",
  protect,
  requireAdmin,
  asyncRoute(async (req, res) =>
    ok(res, {
      users: await User.countDocuments(),
      communities: await Community.countDocuments({
        status: "active",
      }),
      posts: await Post.countDocuments({
        status: "published",
      }),
      openReports: await Report.countDocuments({
        status: "open",
      }),
      pendingBusinesses: await Business.countDocuments({
        status: "pending",
      }),
    })
  )
);

// List business submissions awaiting administrator review.
router.get(
  "/admin/businesses",
  protect,
  requireAdmin,
  asyncRoute(async (req, res) =>
    ok(
      res,
      await page(
        Business,
        { status: "pending" },
        req
      )
    )
  )
);

// List registered users for administrator management.
router.get(
  "/admin/users",
  protect,
  requireAdmin,
  asyncRoute(async (req, res) =>
    ok(res, await page(User, {}, req))
  )
);

// Activate or suspend a user account.
router.patch(
  "/admin/users/:id/status",
  protect,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return fail(res, 400, "isActive must be boolean.");
    }

    // Prevent an administrator from suspending their own account here.
    if (req.params.id === req.user.id && !isActive) {
      return fail(res, 400, "You cannot suspend your own account.");
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).select("-password");

    if (!user) {
      return fail(res, 404, "User not found.");
    }

    ok(res, { user });
  })
);

// List reports for administrator review, optionally filtered by status.
router.get(
  "/admin/reports",
  protect,
  requireAdmin,
  asyncRoute(async (req, res) =>
    ok(
      res,
      await page(
        Report,
        req.query.status ? { status: req.query.status } : {},
        req,
        {
          path: "reporter",
          select: "name email",
        }
      )
    )
  )
);

// Review a report and apply the corresponding moderation action.
router.patch(
  "/admin/reports/:id",
  protect,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const { status, resolution } = req.body;

    if (!["reviewing", "resolved", "dismissed"].includes(status)) {
      return fail(res, 400, "Invalid report status.");
    }

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      {
        status,
        resolution,
        reviewedBy: req.user.id,
      },
      { new: true }
    );

    if (!report) {
      return fail(res, 404, "Report not found.");
    }

    // Apply the selected moderation action when a report is resolved.
    if (status === "resolved") {
      const targetMap = {
        post: Post,
        comment: Comment,
        business: Business,
        opportunity: Opportunity,
      };

      const Target = targetMap[report.targetType];

      if (Target) {
        const targetStatus =
          report.targetType === "business"
            ? "suspended"
            : report.targetType === "opportunity"
              ? "removed"
              : "hidden";

        await Target.findByIdAndUpdate(
          report.targetId,
          { status: targetStatus }
        );
      }
    }

    ok(res, { report });
  })
);

// Allow administrators to update the status of supported content types.
router.patch(
  "/admin/content/:type/:id/status",
  protect,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const models = {
      posts: Post,
      comments: Comment,
      businesses: Business,
      opportunities: Opportunity,
      communities: Community,
    };

    const Model = models[req.params.type];

    if (!Model) {
      return fail(res, 400, "Unsupported content type.");
    }

    const record = await Model.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );

    if (!record) {
      return fail(res, 404, "Content not found.");
    }

    ok(res, { record });
  })
);

// -----------------------------------------------------------------------------
// EXPORT
// -----------------------------------------------------------------------------

// Make this router available to the main Express application.
export default router;

