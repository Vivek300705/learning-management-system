import { createContext, useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import humanizeDuration from "humanize-duration";
import axios from "axios";
import { toast } from "react-toastify";

export const AppContext = createContext();

export const AppContextProvider = ({ children }) => {
  const backendURL =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const currency = import.meta.env.VITE_CURRENCY || "₹";

  const { getToken, isLoaded: authLoaded } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();

  const [allCourses, setAllCourses] = useState([]);
  const [isEducator, setIsEducator] = useState(false);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [userData, setUserData] = useState(null);
  const [userDataLoading, setUserDataLoading] = useState(false);

  // Check if both Clerk auth and user are loaded
  const isClerkReady = authLoaded && userLoaded;

  // Fetch all courses (publicly accessible)
  const fetchAllCourses = async () => {
    try {
      const response = await axios.get(`${backendURL}/api/course/all`);
      const data = response.data;

      if (data.success) {
        setAllCourses(data.courses);
        console.log("✅ Courses fetched:", data.courses.length);
      } else {
        toast.error(data.message || "Failed to load courses");
      }
    } catch (error) {
      console.error("❌ Error fetching courses:", error);
      toast.error(error.response?.data?.message || "Failed to load courses");
    }
  };

  // Fetch user profile data
  const fetchUserData = async () => {
    if (!user) {
      console.log("❌ No user found, skipping fetchUserData");
      return;
    }

    try {
      setUserDataLoading(true);
      console.log("🔄 Fetching user data...");

      const token = await getToken();
      if (!token) {
        console.log("❌ No token available");
        toast.error("Authentication failed. Please login again.");
        return;
      }

      console.log("🔐 Token obtained:", token.substring(0, 30) + "...");

      const response = await axios.get(`${backendURL}/api/user/data`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      console.log("📥 User data response:", response.data);

      if (response.data.success) {
        setUserData(response.data.user);
        console.log("✅ User data set:", response.data.user);
      } else {
        console.error("❌ API error:", response.data.message);
        toast.error(response.data.message || "Failed to load user data");
      }
    } catch (error) {
      console.error("❌ fetchUserData error:", error);

      if (error.response?.status === 401) {
        console.log("🔒 Authentication error - user needs to login");
        setUserData(null);
      } else {
        toast.error(
          error.response?.data?.message || "Failed to load user profile"
        );
      }
    } finally {
      setUserDataLoading(false);
    }
  };

  // Fetch courses the user is enrolled in
  const fetchUserEnrolledCourses = async () => {
    if (!user) {
      console.log("❌ No user found, skipping fetchUserEnrolledCourses");
      return;
    }

    try {
      console.log("🔄 Fetching enrolled courses...");

      const token = await getToken();
      if (!token) {
        console.log("❌ No token for enrolled courses");
        return;
      }

      const response = await axios.get(
        `${backendURL}/api/user/enrolled-courses`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = response.data;
      if (data.success) {
        setEnrolledCourses(data.enrolledCourses?.reverse() || []);
        console.log(
          "✅ Enrolled courses fetched:",
          data.enrolledCourses?.length || 0
        );
      } else {
        console.log("❌ Failed to fetch enrolled courses:", data.message);
        if (data.message !== "User not found") {
          toast.error(data.message);
        }
      }
    } catch (error) {
      console.error("❌ Error fetching enrolled courses:", error);

      if (error.response?.status === 401) {
        console.log("🔒 Auth error for enrolled courses");
      } else if (error.response?.status !== 404) {
        toast.error(
          error.response?.data?.message || "Failed to load enrolled courses"
        );
      }
    }
  };

  // Fetch all courses on mount
  useEffect(() => {
    console.log("🚀 AppContext mounted, fetching all courses...");
    fetchAllCourses();
  }, []);

  // Handle user authentication state changes
  useEffect(() => {
    console.log("🔍 Auth state changed:");
    console.log("  - isClerkReady:", isClerkReady);
    console.log("  - user exists:", !!user);
    console.log("  - user id:", user?.id);

    if (!isClerkReady) {
      console.log("⏳ Clerk not ready yet, waiting...");
      return;
    }

    if (user) {
      console.log("✅ User authenticated, fetching user data...");
      fetchUserData();
      fetchUserEnrolledCourses();
    } else {
      console.log("❌ No user, clearing state...");
      setUserData(null);
      setIsEducator(false);
      setEnrolledCourses([]);
    }
  }, [user, isClerkReady]);

  // Debug userData changes
  useEffect(() => {
    console.log("🔍 UserData state changed:", {
      hasUserData: !!userData,
      userId: userData?._id,
      clerkId: userData?.clerkId,
      enrolledCoursesCount: userData?.enrolledCourses?.length || 0,
    });
  }, [userData]);

  // Utility functions
  const calculateRating = (course) => {
    if (!course?.courseRatings?.length) return 0;
    const total = course.courseRatings.reduce((sum, r) => sum + r.rating, 0);
    return (total / course.courseRatings.length).toFixed(1);
  };

  const calculateChapterTime = (chapter) => {
    const time =
      chapter?.chapterContent?.reduce(
        (acc, lec) => acc + (lec.lectureDuration || 0),
        0
      ) || 0;
    return humanizeDuration(time * 60 * 1000, { units: ["h", "m"] });
  };

  const calculateCourseDuration = (course) => {
    let time = 0;
    course?.courseContent?.forEach((ch) =>
      ch?.chapterContent?.forEach((lec) => {
        time += lec.lectureDuration || 0;
      })
    );
    return humanizeDuration(time * 60 * 1000, { units: ["h", "m"] });
  };

  const calculateNoOfLectures = (course) => {
    return course?.courseContent?.reduce(
      (sum, chapter) => sum + (chapter?.chapterContent?.length || 0),
      0
    );
  };

  // Manual refresh function
  const refreshUserData = async () => {
    console.log("🔄 Manual refresh triggered");
    if (user && isClerkReady) {
      await fetchUserData();
      await fetchUserEnrolledCourses();
    }
  };

  const value = {
    currency,
    allCourses,
    calculateRating,
    calculateChapterTime,
    calculateCourseDuration,
    calculateNoOfLectures,
    isEducator,
    setIsEducator,
    enrolledCourses,
    setEnrolledCourses,
    fetchAllCourses,
    backendUrl: backendURL,
    userData,
    setUserData,
    userDataLoading,
    getToken,
    refreshUserData,
    isClerkReady, // Expose Clerk ready state
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
