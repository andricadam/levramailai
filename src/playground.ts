import "dotenv/config";
import { db } from "./server/db.js";

await db.user.create({
    data: {
        emailAddress: "test@gmail.com",
        firstName: "Huan",
        lastName: "Son",
        imageUrl: "https://example.com/image.png"
    }
})
console.log('done')