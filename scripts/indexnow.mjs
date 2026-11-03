// Pings IndexNow (Bing, Yandex, Seznam, Naver…; Copilot uses Bing's index) with every URL in the live sitemap.
// Run after a deploy that changes content:  node scripts/indexnow.mjs
const HOST = "globalrunnerslogistics.com";
const KEY = "125baca3fa88446282d6e2300920e57d"; // key file: public/125baca3fa88446282d6e2300920e57d.txt
const xml = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }),
});
console.log(`IndexNow: ${res.status} for ${urlList.length} URLs`);
