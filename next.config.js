// @ts-check

const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
});

module.exports = withPWA({
  // Your Next.js config
  //Change `firebase.json`'s "source": "." to "public": "out"
  //and the next two lines for Static Website
  //output: "export",
  //images: { unoptimized: true },
});
