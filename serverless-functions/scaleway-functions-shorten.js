// Scaleway Functions serverless function
// Deploy this to Scaleway Functions

export const handle = async (event, context, callback) => {
  // Enable CORS
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === "OPTIONS") {
    return callback(null, {
      statusCode: 200,
      headers,
      body: "",
    });
  }

  if (event.httpMethod !== "POST") {
    return callback(null, {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    });
  }

  try {
    const { url } = JSON.parse(event.body);

    if (!url) {
      return callback(null, {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "URL is required" }),
      });
    }

    // Validate it's a mailto URL for security
    if (!url.startsWith("mailto:")) {
      return callback(null, {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Only mailto URLs are allowed" }),
      });
    }

    // Retry is.gd up to 3 times with 200ms backoff
    const maxRetries = 3;
    const backoffMs = 200;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const isGdResponse = await fetch(
          `https://is.gd/create.php?format=simple&url=${encodeURIComponent(
            url
          )}`
        );
        const isGdUrl = await isGdResponse.text();

        if (isGdUrl.trim().startsWith("http") && !isGdUrl.includes("Error")) {
          return callback(null, {
            statusCode: 200,
            headers,
            body: JSON.stringify({ shortUrl: isGdUrl.trim() }),
          });
        }

        // If not successful and not the last attempt, wait before retry
        if (attempt < maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, backoffMs * attempt)
          );
        }
      } catch (error) {
        console.error(`is.gd attempt ${attempt} failed:`, error);

        // If not the last attempt, wait before retry
        if (attempt < maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, backoffMs * attempt)
          );
        }
      }
    }

    // All retries failed
    return callback(null, {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error:
          "URL shortening service temporarily unavailable. Please try again later.",
      }),
    });
  } catch (error) {
    console.error("Shortening error:", error);
    return callback(null, {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to create short URL" }),
    });
  }
};
