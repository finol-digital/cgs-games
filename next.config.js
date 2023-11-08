// @ts-check

const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
});

module.exports = withPWA({
  // Your Next.js config
  async rewrites() {
    return [
      {
        source: "/api/proxy/:1",
        destination: `https://:1`,
      },
      {
        source: "/api/proxy/:1/:2",
        destination: `https://:1/:2`,
      },
      {
        source: "/api/proxy/:1/:2/:3",
        destination: `https://:1/:2/:3`,
      },
      {
        source: "/api/proxy/:1/:2/:3/:4",
        destination: `https://:1/:2/:3/:4`,
      },
      {
        source: "/api/proxy/:1/:2/:3/:4/:5",
        destination: `https://:1/:2/:3/:4:/5`,
      },
    ];
  },
  //Change `firebase.json`'s "source": "." to "public": "out"
  //and the next two lines for Static Website
  //output: "export",
  //images: { unoptimized: true },
});
