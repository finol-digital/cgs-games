// @ts-check

const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
});

module.exports = withPWA({
  // Your Next.js config
  async rewrites() {
    return [
      {
        source: "/api/proxy/:first",
        destination: "https://:first",
        basePath: false,
      },
      {
        source: "/api/proxy/:first/:second",
        destination: "https://:first/:second",
        basePath: false,
      },
      {
        source: "/api/proxy/:first/:second/:third",
        destination: "https://:first/:second/:third",
        basePath: false,
      },
      {
        source: "/api/proxy/:first/:second/:third/:fourth",
        destination: "https://:first/:second/:third/:fourth",
        basePath: false,
      },
      {
        source: "/api/proxy/:first/:second/:third/:fourth/:fifth",
        destination: "https://:first/:second/:third/:fourth/:fifth",
        basePath: false,
      },
      {
        source: "/api/proxy/:first/:second/:third/:fourth/:fifth/:sixth",
        destination: "https://:first/:second/:third/:fourth/:fifth/:sixth",
        basePath: false,
      },
    ];
  },
  //Change `firebase.json`'s "source": "." to "public": "out"
  //and the next two lines for Static Website
  //output: "export",
  //images: { unoptimized: true },
});
