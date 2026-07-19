const tokens = new Map();

function rememberJobAuth(jobIds, token) {
  jobIds.forEach((id) => tokens.set(Number(id), token));
}
function getJobAuth(jobId) {
  return tokens.get(Number(jobId));
}
function forgetJobAuth(jobId) {
  tokens.delete(Number(jobId));
}

module.exports = { rememberJobAuth, getJobAuth, forgetJobAuth };
