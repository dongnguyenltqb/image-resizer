# S3 Notes

- Policy

  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": ["s3:Put*"],
        "Resource": ["arn:aws:s3:::spiritlabs-image-resizer/*"]
      }
    ]
  }
  ```

- Cors

  ```json
  [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "POST", "HEAD", "PUT"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": [],
      "MaxAgeSeconds": 3000
    }
  ]
  ```
