import "dotenv/config";
import mongoose from "mongoose"; 
import app from "./app.js"; 
import connectDB from "./config/database.js"; 
import { validateProductionEnvironment } from "./config/environment.js";
import { startCourseCleanupScheduler } from "./services/course-cleanup.service.js";
import { startUploadCleanupScheduler } from "./services/upload-cleanup.service.js";

const PORT = process.env.PORT || 5000; 

validateProductionEnvironment();
await connectDB(); 
startCourseCleanupScheduler();
startUploadCleanupScheduler();

const server = app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`); //
});

// ==========================================
// CƠ CHẾ ĐÓNG HỆ THỐNG AN TOÀN (GRACEFUL SHUTDOWN)
// Cực kỳ quan trọng khi deploy Docker Container lên AWS EC2 ở Week 3
// ==========================================
const shutdown = async () => {
    console.log("\n🛑 Đang tiến hành dừng Server Express một cách an toàn...");
    
    server.close(async () => {
        console.log("✈️ Server Express đã dừng nhận các request mới.");
        try {
            await mongoose.connection.close();
            console.log("🔌 Đã đóng kết nối MongoDB giải phóng tài nguyên thành công.");
            process.exit(0);
        } catch (err) {
            console.error("❌ Lỗi xảy ra khi đóng kết nối MongoDB:", err.message);
            process.exit(1);
        }
    });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
