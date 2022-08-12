# CrabJS
#### easy work is comming... (under development)

[![NPM version](https://img.shields.io/npm/v/crabjs)](https://www.npmjs.com/package/crabjs)

CrabJS is a powerfull API Framework that works with a lot of outstanding modules and is fully configured by annotations.

To install, run:

```npm install -g crabjs ```

If you want to see available options con cjs, you can see the help. 

```cjs -h``` or
```cjs --help```

To create / initiate a project, just type inside the directory:

```cjs init```


## How does it works?

With CrabJS cli, you can easily create API controllers and entities for your backend. When you initiate a project, you will receive your first credentials to your API. 
CrabJS uses Express to route paths and it is so easy to create an example controller. To do this, just type:

```cjs create mycontroller```

As we use annotations to perform api settings, you need to specify the paths you want to map. After you create an controller, you will see this content on controller file:
```
/**
* @Controller
* @route('/mycontroller')
*/
  function mycontroller() {
  /**
    * @route('/')
    * @method('GET')
    */
    this.get = function (req, res) {
       res.send("alive");
    } 
  }

module.exports = mycontroller;
```

The routes for controller are specified with annotations. To test this controller, you just need run the ptoject and do a request (GET method) for your project url:

Run:
``` npm start ``` or
``` node app.js ```

Url to do the request:

``` http://your_api_url/mycontroller ```
