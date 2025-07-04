import React, { useState, useRef, useEffect, useContext } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import uniqid from "uniqid";
import assets from "../../../assets/assets";
import { AppContext } from "../../../context/AppContext";
import { toast } from "react-toastify";
import axios from "axios";

const AddCourse = () => {
  const { backendURL, getToken } = useContext(AppContext);

  const quillRef = useRef(null);
  const editorRef = useRef(null);

  const [courseTitle, setCourseTitle] = useState("");
  const [coursePrice, setCoursePrice] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(""); // Added separate state for preview
  const [chapters, setChapters] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [currentChapterId, setCurrentChapterId] = useState(null);
  const [lectureDetails, setLectureDetails] = useState({
    lectureTitle: "",
    lectureDuration: "",
    lectureUrl: "",
    isPreviewFree: false,
  });

  // Initialize Quill editor
  useEffect(() => {
    if (!quillRef.current && editorRef.current) {
      quillRef.current = new Quill(editorRef.current, {
        theme: "snow",
        modules: {
          toolbar: [
            [{ header: [1, 2, false] }],
            ["bold", "italic", "underline", "strike"],
            [{ list: "ordered" }, { list: "bullet" }],
            ["link", "image"],
            ["clean"],
          ],
        },
        placeholder: "Write course description here...",
      });
    }
  }, []);

  // Clean up image preview URL when component unmounts or image changes
  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleChapter = (action, chapterId) => {
    if (action === "add") {
      const title = prompt("Enter Chapter Name:");
      if (title) {
        const newChapter = {
          chapterId: uniqid(),
          chapterTitle: title,
          chapterContent: [],
          collapsed: false,
          chapterOrder:
            chapters.length > 0 ? chapters.slice(-1)[0].chapterOrder + 1 : 1,
        };
        setChapters([...chapters, newChapter]);
      }
    } else if (action === "remove") {
      setChapters(
        chapters.filter((chapter) => chapter.chapterId !== chapterId)
      );
    } else if (action === "toggle") {
      setChapters(
        chapters.map((chapter) =>
          chapter.chapterId === chapterId
            ? { ...chapter, collapsed: !chapter.collapsed }
            : chapter
        )
      );
    }
  };

  const handleLecture = (action, chapterId, lectureIndex) => {
    if (action === "add") {
      setCurrentChapterId(chapterId);
      setShowPopup(true);
    } else if (action === "remove") {
      setChapters(
        chapters.map((chapter) => {
          if (chapter.chapterId === chapterId) {
            const updatedContent = [...chapter.chapterContent];
            updatedContent.splice(lectureIndex, 1);
            // Update lecture orders after removal
            updatedContent.forEach((lecture, index) => {
              lecture.lectureOrder = index + 1;
            });
            return { ...chapter, chapterContent: updatedContent };
          }
          return chapter;
        })
      );
    }
  };

  const handleSaveLecture = () => {
    if (!currentChapterId) return;

    // Validate lecture details
    if (!lectureDetails.lectureTitle.trim()) {
      toast.error("Please enter lecture title");
      return;
    }
    if (
      !lectureDetails.lectureDuration ||
      lectureDetails.lectureDuration <= 0
    ) {
      toast.error("Please enter valid lecture duration");
      return;
    }
    if (!lectureDetails.lectureUrl.trim()) {
      toast.error("Please enter lecture URL");
      return;
    }

    const updatedChapters = chapters.map((chapter) => {
      if (chapter.chapterId === currentChapterId) {
        const newLecture = {
          lectureId: uniqid(),
          lectureTitle: lectureDetails.lectureTitle.trim(),
          lectureDuration: Number(lectureDetails.lectureDuration),
          lectureUrl: lectureDetails.lectureUrl.trim(),
          isPreviewFree: lectureDetails.isPreviewFree,
          lectureOrder: chapter.chapterContent.length + 1,
        };

        return {
          ...chapter,
          chapterContent: [...chapter.chapterContent, newLecture],
        };
      }
      return chapter;
    });

    setChapters(updatedChapters);
    setShowPopup(false);
    setCurrentChapterId(null);
    setLectureDetails({
      lectureTitle: "",
      lectureDuration: "",
      lectureUrl: "",
      isPreviewFree: false,
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast.error("Please select a valid image file");
        return;
      }

      // Validate file size (e.g., max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image file size should be less than 5MB");
        return;
      }

      setImage(file);
      // Clean up previous preview URL
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      // Create new preview URL
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Validation
      if (!courseTitle.trim()) {
        toast.error("Please enter course title");
        return;
      }

      if (!image) {
        toast.error("Please select a course thumbnail");
        return;
      }

      if (!quillRef.current || !quillRef.current.root.innerHTML.trim()) {
        toast.error("Please enter course description");
        return;
      }

      if (chapters.length === 0) {
        toast.error("Please add at least one chapter");
        return;
      }

      // Check if all chapters have at least one lecture
      const chaptersWithoutLectures = chapters.filter(
        (chapter) => chapter.chapterContent.length === 0
      );
      if (chaptersWithoutLectures.length > 0) {
        toast.error("All chapters must have at least one lecture");
        return;
      }

      const courseData = {
        courseTitle: courseTitle.trim(),
        courseDescription: quillRef.current.root.innerHTML,
        coursePrice: Number(coursePrice),
        discount: Number(discount),
        courseContent: chapters,
      };

      const formData = new FormData();
      formData.append("courseData", JSON.stringify(courseData));
      formData.append("image", image);

      const token = await getToken();
      const { data } = await axios.post(
        backendURL + "/api/educator/add-course",
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        toast.success(data.message);
        // Reset form
        setCourseTitle("");
        setCoursePrice(0);
        setDiscount(0);
        setImage(null);
        if (imagePreview) {
          URL.revokeObjectURL(imagePreview);
        }
        setImagePreview("");
        setChapters([]);
        if (quillRef.current) {
          quillRef.current.root.innerHTML = "";
        }
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error("Error adding course:", error);
      toast.error(error.response?.data?.message || "Failed to add course");
    }
  };

  return (
    <div className="h-screen overflow-scroll flex flex-col items-start justify-between md:p-8 md:pb-0 p-4 pt-8 pb-0">
      <h1 className="text-2xl font-bold mb-6">Add New Course</h1>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 max-w-md w-full text-gray-500"
      >
        <div className="flex flex-col gap-1">
          <p>Course Title</p>
          <input
            onChange={(e) => setCourseTitle(e.target.value)}
            value={courseTitle}
            type="text"
            placeholder="Type here"
            className="outline-none md:py-2.5 py-2 px-3 rounded border border-gray-500"
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <p>Course Description</p>
          <div ref={editorRef} className="h-64 mb-4"></div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <p>Course Price ($)</p>
            <input
              type="number"
              value={coursePrice}
              onChange={(e) => setCoursePrice(e.target.value)}
              placeholder="0"
              min="0"
              step="0.01"
              className="outline-none md:py-2.5 py-2 w-28 px-3 rounded border border-gray-500"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <p>Discount (%)</p>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="0"
              min="0"
              max="100"
              className="outline-none md:py-2.5 py-2 w-28 px-3 rounded border border-gray-500"
            />
          </div>

          <div className="flex md:flex-row flex-col items-center gap-3">
            <p>Course Thumbnail</p>
            <label
              htmlFor="thumbnailImage"
              className="flex items-center gap-3 cursor-pointer"
            >
              <img
                src={assets.file_upload_icon}
                alt="Upload"
                className="p-3 bg-blue-500 rounded"
              />
              <input
                type="file"
                id="thumbnailImage"
                onChange={handleImageChange}
                accept="image/*"
                hidden
              />
              {imagePreview && (
                <img
                  className="max-h-10 max-w-10 object-cover rounded"
                  src={imagePreview}
                  alt="Preview"
                />
              )}
            </label>
          </div>
        </div>

        {/* Chapters & Lectures Section */}
        <div>
          <h2 className="text-lg font-bold my-4">Course Chapters</h2>

          {chapters.map((chapter, chapterIndex) => (
            <div
              key={chapter.chapterId}
              className="bg-white border rounded-lg mb-4"
            >
              <div className="flex justify-between items-center p-4 border-b">
                <div className="flex items-center">
                  <img
                    onClick={() => handleChapter("toggle", chapter.chapterId)}
                    src={assets.dropdown_icon}
                    width={14}
                    alt="Toggle"
                    className={`mr-2 cursor-pointer transition-all ${
                      chapter.collapsed && "-rotate-90"
                    }`}
                  />
                  <span className="font-semibold">
                    {chapterIndex + 1}. {chapter.chapterTitle}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">
                    {chapter.chapterContent.length} Lectures
                  </span>
                  <img
                    onClick={() => handleChapter("remove", chapter.chapterId)}
                    src={assets.cross_icon}
                    alt="Remove"
                    className="cursor-pointer"
                  />
                </div>
              </div>

              {!chapter.collapsed && (
                <div className="p-4">
                  {chapter.chapterContent.map((lecture, lectureIndex) => (
                    <div
                      key={lecture.lectureId}
                      className="flex justify-between items-center mb-2"
                    >
                      <span className="text-sm">
                        {lectureIndex + 1}. {lecture.lectureTitle} -{" "}
                        {lecture.lectureDuration} mins -{" "}
                        <a
                          href={lecture.lectureUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          link
                        </a>{" "}
                        - {lecture.isPreviewFree ? "Free Preview" : "Paid"}
                      </span>
                      <img
                        src={assets.cross_icon}
                        alt="Remove"
                        onClick={() =>
                          handleLecture(
                            "remove",
                            chapter.chapterId,
                            lectureIndex
                          )
                        }
                        className="cursor-pointer"
                      />
                    </div>
                  ))}
                  <div
                    className="inline-flex bg-gray-100 p-2 rounded cursor-pointer mt-2 hover:bg-gray-200"
                    onClick={() => handleLecture("add", chapter.chapterId)}
                  >
                    + Add Lecture
                  </div>
                </div>
              )}
            </div>
          ))}

          <div
            className="flex justify-center items-center bg-blue-100 p-2 rounded-lg cursor-pointer hover:bg-blue-200"
            onClick={() => handleChapter("add")}
          >
            + Add Chapter
          </div>
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium mt-6"
        >
          Save Course
        </button>
      </form>

      {/* Add Lecture Popup */}
      {showPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50">
          <div className="bg-white text-gray-700 p-6 rounded-lg relative w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-4">Add Lecture</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Lecture Title
              </label>
              <input
                type="text"
                className="w-full border rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={lectureDetails.lectureTitle}
                onChange={(e) =>
                  setLectureDetails({
                    ...lectureDetails,
                    lectureTitle: e.target.value,
                  })
                }
                placeholder="Enter lecture title"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Lecture Duration (mins)
              </label>
              <input
                type="number"
                className="w-full border rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={lectureDetails.lectureDuration}
                onChange={(e) =>
                  setLectureDetails({
                    ...lectureDetails,
                    lectureDuration: e.target.value,
                  })
                }
                placeholder="Enter duration in minutes"
                min="1"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Lecture URL
              </label>
              <input
                type="url"
                className="w-full border rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={lectureDetails.lectureUrl}
                onChange={(e) =>
                  setLectureDetails({
                    ...lectureDetails,
                    lectureUrl: e.target.value,
                  })
                }
                placeholder="Enter lecture URL"
              />
            </div>

            <div className="flex items-center gap-2 mb-6">
              <input
                type="checkbox"
                id="isPreviewFree"
                className="scale-125"
                checked={lectureDetails.isPreviewFree}
                onChange={(e) =>
                  setLectureDetails({
                    ...lectureDetails,
                    isPreviewFree: e.target.checked,
                  })
                }
              />
              <label htmlFor="isPreviewFree" className="text-sm font-medium">
                Is Preview Free?
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                onClick={() => {
                  setShowPopup(false);
                  setCurrentChapterId(null);
                  setLectureDetails({
                    lectureTitle: "",
                    lectureDuration: "",
                    lectureUrl: "",
                    isPreviewFree: false,
                  });
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                onClick={handleSaveLecture}
              >
                Add Lecture
              </button>
            </div>

            <img
              onClick={() => {
                setShowPopup(false);
                setCurrentChapterId(null);
                setLectureDetails({
                  lectureTitle: "",
                  lectureDuration: "",
                  lectureUrl: "",
                  isPreviewFree: false,
                });
              }}
              src={assets.cross_icon}
              className="absolute top-4 right-4 w-4 cursor-pointer"
              alt="Close"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AddCourse;
