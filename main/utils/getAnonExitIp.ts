const axios = require("axios");

export async function getAnonExitIp() {
  try {
    const response = await axios.get("https://check.en.anyone.tech/api/ip");
    const exitIp = response.data.IP;
    console.log("Anon exit node IP:", exitIp);
    return exitIp;
  } catch (error) {
    console.error("Error fetching Anon exit IP:", error);
  }
}
