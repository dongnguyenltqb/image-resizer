require("dotenv").config();
const logger = require("pino")();
const AWS = require("aws-sdk");
const s3 = new AWS.S3({
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET,
  region: process.env.S3_REGION,
});

const fastify = require("fastify")();
const fs = require("fs");
const util = require("util");
const path = require("path");
const { pipeline } = require("stream");
const pump = util.promisify(pipeline);
const sharp = require("sharp");

fastify.register(require("fastify-multipart"));

const sizes = [1920, 1720, 1280, 1080, 800, 860, 720, 630, 480];
const imageBucketName = process.env.S3_BUCKET_NAME;

fastify.get("/", (req, reply) => {
  reply.header("Content-Type", "text/html");
  reply.send(fs.createReadStream(path.join(__dirname, "./index.html")));
});

fastify.post("/", async function (req, reply) {
  const data = await req.file();

  let fileId = Math.random().toString(32).slice(2, 15);
  let fileExt = path.extname(data.filename).substr(1);

  let dest = path.join(__dirname, "/temp/", fileId + "." + fileExt);
  try {
    // save file to disk
    await pump(data.file, fs.createWriteStream(dest));

    // get file metadata
    let img = sharp(dest);
    let metadata = await img.metadata();
    let { width, height } = metadata;

    // resize
    let tasks = sizes.map(async (targetWidth) => {
      if (width < targetWidth) return false;
      let resizedFileId = fileId + "-" + targetWidth;

      // upload to s3
      let resizedImg = img.resize(targetWidth).toFormat("jpeg");
      let fileContent = await resizedImg.toBuffer();
      let s3ObjectKey = resizedFileId + "." + fileExt;

      let object = await s3
        .upload({
          Bucket: imageBucketName,
          Key: s3ObjectKey,
          Body: fileContent,
          ContentType: data.mimetype,
          ACL: "public-read",
          CacheControl: "public, max-age=108000, immutable",
        })
        .promise();

      return {
        width: targetWidth,
        height: (targetWidth * height) / width,
        url: object.Location,
      };
    });
    tasks.push(
      (async () => {
        let object = await s3
          .upload({
            Bucket: imageBucketName,
            Key: fileId + "." + fileExt,
            Body: fs.createReadStream(dest),
            ContentType: data.mimetype,
            ACL: "public-read",
            CacheControl: "public, max-age=108000, immutable",
          })
          .promise();

        return {
          width,
          height,
          url: object.Location,
        };
      })()
    );
    let result = await Promise.all(tasks);

    result = result
      .filter((x) => x !== false)
      .sort((a, b) => b.width - a.width);
    reply.send({
      status: true,
      data: result,
    });
    fs.unlink(dest, (err) => {
      if (err) logger.error(err);
    });
  } catch (err) {
    fs.unlink(dest, () => {});
    logger.error(err);
    reply.code(500);
    return {
      status: false,
    };
  }
});

fastify.listen(process.env.PORT || -1, (err) => {
  if (err) throw err;
  console.log(`server listening on ${fastify.server.address().port}`);
});
