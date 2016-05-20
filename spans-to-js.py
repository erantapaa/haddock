#!/usr/bin/env python
#
# Convert a typed-srcspans files to Javascript.
#
# Usage:  python spans-to-js.py files...

import re
import os
import sys

def convert_file(path):
  dir = os.path.dirname(path)
  spans = []
  modname = None
  outpath = None
  with open(path) as fh:
    for line in fh:
      m = re.match("module\s+(\S+)", line)
      if m:
        if modname:
          write_spans(outpath, spans)
        spans = []
        modname = m.group(1)
        outpath = os.path.join(dir, "src/type-spans-" + modname + ".js")
        continue
      m = re.match("(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(.*)", line)
      if m:
        r = '[{},{},{},{},\"{}\"]'.format(m.group(1), m.group(2), m.group(3), m.group(4), m.group(5))
        spans.append(r)
    if modname:
      write_spans(outpath, spans)

def write_spans(path, spans):
  print "Writing", path
  with open(path, 'w') as out:
    out.write("typed_spans = [\n")
    first = True
    for r in spans:
      if not first:
        out.write(",\n")
      else:
        first = False
      out.write(r)
    out.write("\n]\n")

def main():
  for path in sys.argv[1:]:
    convert_file(path)

if __name__ == '__main__':
  main()

