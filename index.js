import "dotenv/config";
import { TwitterApi } from "twitter-api-v2";

const {
  TWITCH_CLIENT_ID,
  TWITCH_ACCESS_TOKEN,
  TWITCH_BROADCASTER_ID,
  TWITCH_MODERATOR_ID,
  X_APP_KEY,
  X_APP_SECRET,
  X_ACCESS_TOKEN,
  X_ACCESS_SECRET
} = process.env;

const BUNDLE_SIZE = 1;
let seenFollowers = new Set();
let pendingFollowers = [];

const xClient = new TwitterApi({
  appKey: X_APP_KEY,
  appSecret: X_APP_SECRET,
  accessToken: X_ACCESS_TOKEN,
  accessSecret: X_ACCESS_SECRET
});

async function getLatestFollowers() {
  const url =
    `https://api.twitch.tv/helix/channels/followers` +
    `?broadcaster_id=${TWITCH_BROADCASTER_ID}` +
    `&moderator_id=${TWITCH_MODERATOR_ID}` +
    `&first=20`;

  const res = await fetch(url, {
    headers: {
      "Client-ID": TWITCH_CLIENT_ID,
      Authorization: `Bearer ${TWITCH_ACCESS_TOKEN}`
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twitch error ${res.status}: ${text}`);
  }

  return await res.json();
}

async function postToX(followers) {
  const names = followers.map(f => `@${f.user_login}`).join(", ");

  const tweet =
`5 new followers just entered the Dojo 🥷

Welcome ${names}

The Ninja Cat stream keeps growing.
Follow the purple app: twitch.tv/ninjacatonsol`;

  await xClient.v2.tweet(tweet);
  console.log("Posted to X:", tweet);
}

async function checkFollowers() {
  try {
    const data = await getLatestFollowers();

    const followers = data.data || [];

    for (const follower of followers.reverse()) {
      if (!seenFollowers.has(follower.user_id)) {
        seenFollowers.add(follower.user_id);
        pendingFollowers.push(follower);
        console.log("New follower:", follower.user_login);
      }
    }

    while (pendingFollowers.length >= BUNDLE_SIZE) {
      const bundle = pendingFollowers.splice(0, BUNDLE_SIZE);
      await postToX(bundle);
    }
  } catch (err) {
    console.error(err.message);
  }
}

async function start() {
  console.log("Twitch follower to X bot started.");

  const firstRun = await getLatestFollowers();
  for (const follower of firstRun.data || []) {
    seenFollowers.add(follower.user_id);
  }

  setInterval(checkFollowers, 60 * 1000);
}

start();
