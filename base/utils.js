const log = require('./log');

function Util() {
   this.checkLibExists = function(libname) {
       try {
           require.resolve(libname);
           return true;
       } catch(e) {
           log.error(libname+" is not found");
           return false;
       }
   }
}

module.exports = new Util();