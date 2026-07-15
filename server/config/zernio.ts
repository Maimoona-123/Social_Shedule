import {Zernio} from '@zernio/node';

const zernio = new Zernio({
    apiKey: process.env.ZERNIO_API_KEY || "",
    baseURL: 'https://zernio.com/api'
})

console.log("ZERNIO KEY EXISTS:", !!process.env.ZERNIO_API_KEY);

export default zernio;