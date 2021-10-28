const qs = require("querystring");

const formatQuery = (queryObj) => {
  if (JSON.stringify(queryObj).length !== 2) {
    return "?" + qs.stringify(queryObj);
  } else {
    return "";
  }
};

module.exports = {
  formatQuery,
};
