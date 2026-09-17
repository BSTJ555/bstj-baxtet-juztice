import { initializeApp } from "firebase-admin/app";

initializeApp();

export { initiateAllocation } from "./donations/initiateAllocation";
export { confirmAllocation } from "./donations/confirmAllocation";
export { expireStaleAllocations } from "./scheduler/expireStaleAllocations";
