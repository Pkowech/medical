import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "auto",
  endpoint: "https://2674f2a3a71a5a584604cebb68700c5f.r2.cloudflarestorage.com",
  credentials: {
    accessKeyId: "ee144f3169aa7a88c88beee9303eec3d",
    secretAccessKey: "ab58c21424b6d159882877b0b4d6c99a6bd0935f8f740d4383a62e6a79432917",
  },
});

async function run() {
  try {
    const data = await s3.send(new ListBucketsCommand({}));
    console.log("Buckets:", data.Buckets?.map(b => b.Name));
    console.log("Success: R2 is reachable!");
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
