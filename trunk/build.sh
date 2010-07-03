#!/bin/bash
##!/usr/bin/bash

# current dir is "duplicate-contact-manager-for-thunderbird"

# clean build directory
rm -rf build
mkdir build

# copy install.rdf and chrome.manifest
cd "{b4447f60-db9c-11da-a94d-0800200c9a66}" || exit
# current dir is "duplicate-contact-manager-for-thunderbird/{b4447f60-db9c-11da-a94d-0800200c9a66}"

cp "chrome.manifest" ../build/
cp "install.rdf" ../build/
cp -r chrome ../build/
cp -r locale ../build/
cp -r skin ../build/

cd ../build || exit
# current dir is "duplicate-contact-manager-for-thunderbird/build"

# remove SVN directories
find . -type d -name ".svn" | xargs rm -rf

# remove backup files
find . -name "*~" | xargs rm -f

# remove .jEdit marks files
find . -name "*.marks" | xargs rm -f

zip -r build.zip *

cd ..
# current dir is "duplicate-contact-manager-for-thunderbird"

mv build/build.zip .
rm -rf build

# rename zip to xpi
DATE=$(date +"%Y%m%d-%H%M")
mv build.zip duplicate-contact-manager-$DATE-tb.xpi

