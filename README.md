# cfpm-cli

## Command Line Interface for CF Package Manager

Tim Pettersen's "Building command line tools with Node.js" was referenced and borrowed from in the building of this cli.

cli:
   cfpm init: creates .about.json
   cfpm update patch/minor/major: reads and
     updates v# in .about.json
   When downloaded, create an about.md with version number
     and package info from response header


 server:
   update route checks for latest version, then creates
     new version number based on patch/minor/major
     parameters passed in. Maybe take a -c comment
   When package is requested, return with v.#
     in response header.
   /packages/package-name/:version
