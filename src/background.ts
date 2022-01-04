// Import the WebExtensions polyfill, for cross-browser compatibility.
// Note that Rally and WebScience currently only support Firefox.
import { Rally } from "@mozilla/rally";
import { startStudy } from "./StudyModule.js";

const publicKey = {
    "kty": "EC",
    "crv": "P-256",
    "x": "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU",
    "y": "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0",
    "kid": "Public key used in JWS spec Appendix A.3 example"
};

// Initialize the Rally API.
const rally = new Rally();
rally.initialize(
    // A sample key id used for encrypting data.
    "sample-invalid-key-id",
    // A sample *valid* JWK object for the encryption.
    publicKey,
    // The following constant is automatically provided by
    // the build system.
    __ENABLE_DEVELOPER_MODE__,
    (() => { return; }),
).then(_resolve => {
    // The Rally API has been initialized.
    startStudy(rally);
}, _reject => {
    // Do not start the study in this case. Something
    // went wrong.
});