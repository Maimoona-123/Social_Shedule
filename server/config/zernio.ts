import "dotenv/config";
import { Zernio } from "@zernio/node";

console.log("API KEY =", process.env.ZERNIO_API_KEY);

const zernio = new Zernio({
  apiKey: process.env.ZERNIO_API_KEY!,
});

export default zernio;