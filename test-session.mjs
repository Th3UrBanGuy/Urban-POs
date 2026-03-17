const { verifySessionToken, createSessionToken } = require('./src/lib/session');

async function test() {
    try {
        const token = await createSessionToken({ isMaster: true, pages: [], tagName: 'Test' });
        console.log("Token:", token);
        const payload = await verifySessionToken(token);
        console.log("Payload:", payload);
    } catch (err) {
        console.error("Error:", err);
    }
}

test();
