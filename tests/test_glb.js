const THREE = require('three');
const fs = require('fs');

// We just want to check how the rotations apply, but we need GLTFLoader...
// Since it's complex to run three.js without a DOM, we can just log the bones that are being matched.
