#!/usr/bin/env bash

mydir="$(cd "$(dirname "$0")" && pwd)"

SKIP_GIT_CHECK="false"
while getopts "fs" opt; do
  case $opt in
    f)
      echo "skipping git check"
      SKIP_GIT_CHECK="true"
      ;;
    s)
      echo "skipping secrets set"
      SKIP_SECRETS_SET="true"
      ;;
  esac
done

if [[ ! -z $(git status --porcelain=v1) ]] && [[ $SKIP_GIT_CHECK != "true" ]];
then
  echo "uncommitted changes, must use -f option to deploy"
  exit 1
fi

cd $mydir/../web
pnpm run clean
pnpm run build
cd $mydir/..

if [[ $SKIP_SECRETS_SET != "true" ]];
then 
  while read -r line
  do
    key="SLIKE_SECRET_${line%:*}"
    val=${line#*:}
    fly secrets set "$key=$val"
  done < "server/secrets.config"
fi

fly deploy