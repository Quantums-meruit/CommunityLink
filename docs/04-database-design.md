# Database design

Collections: users, communities, memberships, posts, comments, events, eventregistrations, businesses, opportunities, applications, reports and notifications. References use MongoDB ObjectIds. Memberships, event registrations and applications enforce compound unique indexes to prevent duplicate relationships. Password hashes are excluded from normal user queries and API responses.
