function Util() {
   this.checkLibExists = function(libName) {
       try {
           require.resolve(libName);
           return true;
       } catch(e) {
           return false;
       }
   }
}

module.exports = new Util();