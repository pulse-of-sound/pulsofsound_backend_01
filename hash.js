const bcrypt = require('bcrypt');

(async () => {
  const hash = await bcrypt.hash("yara1", 10);
  console.log(hash);
})();
