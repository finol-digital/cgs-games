const withPWA = require("next-pwa");

module.exports = withPWA({
  pwa: {
    dest: "public",
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === "development",
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  //Static Website with these 2 lines and firebase.json source vs public
  //output: "export",
  //images: { unoptimized: true },
};

module.exports = nextConfig;
