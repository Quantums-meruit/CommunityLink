
import axios from "axios";

// Create one shared API client for all CommunityLink requests.
// Axios will set the correct Content-Type based on the request data.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",

  // Required because authentication uses HTTP-only cookies.
  withCredentials: true,
});

// Keep error messages consistent across the application.
api.interceptors.response.use(
  (response) => response,
  (error) =>
    Promise.reject(
      new Error(
        error.response?.data?.message ||
        error.message ||
        "Network request failed."
      )
    )
);

export default api;
