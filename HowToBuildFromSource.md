## Introduction ##

Thunderbird add-ons are distributed as a single file with .XPI extension. These files are ZIP archives containing the files you can find in the source folder "{b4447f60-db9c-11da-a94d-0800200c9a66}".

## Requirements ##

In order to use the build script, you need an envionment capable of running shell scripts. This could be, for example, one of the following:

  * Unix / Linux
  * Mac OS X
  * Windows with [Cygwin](http://www.cygwin.com/)

Furthermore, you need to have the following command line tools installed:

  * svn
  * find
  * zip

Under Cygwin, "find" is available in the package named "findutils", zip is simply called "zip" and "svn" might appear as a package called "subversion".

## Details ##

The build process _could_ be done manually by creating a ZIP file with a certain folder structure, but it's easier to use the shell script **build.sh** in the root of the SVN trunk.

In order to build the XPI file, simply go to the directory containing the file build.sh and run the script.

This will generate an output file named like this:

**duplicate-contact-manager-YYYYMMDD-HHMM-tb.xpi**