import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const publicPages = [
  {
    match: (path) => path === "/",
    title: "CommunityLink | Your community, connected",
    description:
      "Discover communities, local events, businesses and opportunities with CommunityLink.",
  },
  {
    match: (path) => path === "/communities",
    title: "Discover Communities | CommunityLink",
    description:
      "Explore communities, meet people with shared interests and find where you belong.",
  },
  {
    match: (path) => path === "/events",
    title: "Community Events | CommunityLink",
    description:
      "Discover activities and events happening across your communities.",
  },
  {
    match: (path) => path === "/businesses",
    title: "Community Businesses | CommunityLink",
    description:
      "Discover and support businesses serving your local communities.",
  },
  {
    match: (path) => path === "/opportunities",
    title: "Community Opportunities | CommunityLink",
    description:
      "Explore opportunities shared with the CommunityLink network.",
  },
  {
    match: (path) => path === "/login",
    title: "Sign in | CommunityLink",
    description: "Sign in to continue to your CommunityLink account.",
  },
  {
    match: (path) => path === "/register",
    title: "Create an Account | CommunityLink",
    description:
      "Join CommunityLink to discover communities, events and opportunities.",
  },
];

const privatePaths = [
  /^\/dashboard(?:\/|$)/,
  /^\/profile(?:\/|$)/,
  /^\/applications(?:\/|$)/,
  /^\/notifications(?:\/|$)/,
  /^\/admin(?:\/|$)/,
  /^\/communities\/create(?:\/|$)/,
  /^\/events\/create(?:\/|$)/,
  /^\/businesses\/create(?:\/|$)/,
  /^\/opportunities\/create(?:\/|$)/,
];

const privatePages = [
  {
    match: (path) => path === "/dashboard",
    title: "Home Feed | CommunityLink",
    description: "See updates and activity from your CommunityLink network.",
  },
  {
    match: (path) => path === "/profile",
    title: "Your Profile | CommunityLink",
    description: "Manage your CommunityLink profile and account details.",
  },
  {
    match: (path) => path === "/applications",
    title: "Your Applications | CommunityLink",
    description: "Review your CommunityLink applications.",
  },
  {
    match: (path) => path === "/notifications",
    title: "Notifications | CommunityLink",
    description: "View your CommunityLink notifications.",
  },
  {
    match: (path) => path === "/admin",
    title: "Administration | CommunityLink",
    description: "Manage CommunityLink.",
  },
  {
    match: (path) => /\/create\/?$/.test(path),
    title: "Create a Listing | CommunityLink",
    description: "Create a new listing for the CommunityLink network.",
  },
];

function setMetaContent(selector, attributes, content) {
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement("meta");
    Object.entries(attributes).forEach(([name, value]) => {
      element.setAttribute(name, value);
    });
    document.head.append(element);
  }

  element.setAttribute("content", content);
}

export default function PageMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    const isPrivate = privatePaths.some((pattern) => pattern.test(pathname));
    const page = publicPages.find(({ match }) => match(pathname));
    const privatePage = privatePages.find(({ match }) => match(pathname));
    const title =
      page?.title ||
      privatePage?.title ||
      (pathname.startsWith("/communities/")
        ? "Community | CommunityLink"
        : pathname.startsWith("/events/")
          ? "Event | CommunityLink"
          : pathname.startsWith("/businesses/")
            ? "Business | CommunityLink"
            : pathname.startsWith("/opportunities/")
              ? "Opportunity | CommunityLink"
              : "Page not found | CommunityLink");
    const description =
      page?.description ||
      privatePage?.description ||
      "Explore communities, events, businesses and opportunities with CommunityLink.";

    document.title = title;
    setMetaContent('meta[name="description"]', { name: "description" }, description);
    setMetaContent(
      'meta[name="robots"]',
      { name: "robots" },
      isPrivate ? "noindex, nofollow" : "index, follow",
    );
    setMetaContent('meta[property="og:title"]', { property: "og:title" }, title);
    setMetaContent(
      'meta[property="og:description"]',
      { property: "og:description" },
      description,
    );
    setMetaContent(
      'meta[name="twitter:card"]',
      { name: "twitter:card" },
      "summary",
    );
  }, [pathname]);

  return null;
}
