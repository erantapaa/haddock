
var highlight = function (on) {
	return function () {
		var links = document.getElementsByTagName('a');
		for (var i = 0; i < links.length; i++) {
			var that = links[i];

			if (this.href != that.href) {
				continue;
			}

			if (on) {
				that.classList.add("hover-highlight");
			} else {
				that.classList.remove("hover-highlight");
			}
		}
	}
};

var typed_spans;

function reportLocation(e) {
  var x = e.clientX, y = e.clientY, elt = document.elementFromPoint(x,y)

  var found
  var initlen = elt.textContent.length
  var textlen = 0
  var count = 1000
  var wentup = false

  while (count > 0 && elt) {
    count = count - 1
    // console.log("at", elt)
    if (elt.nodeType == 3) {
      textlen += elt.textContent.length
    } else if (found = atLineStart(elt)) {
      break;
    } else if (!wentup) {
      textlen += elt.textContent.length
    }
    wentup = false
    var next = elt.previousSibling
    if (!next) {
      next = elt.parentNode
      wentup = true
      if (!next || next == elt) {
        break
      }
    }
    elt = next
  }
  if (found) {
    var minCol = textlen - initlen + 1
    var maxCol = textlen + 1
    console.log("found:", found, "minCol:", minCol, "maxCol:", maxCol)
    var spans = find_spans(found, minCol, maxCol)
    innermost_span(spans)
  } else {
    console.log("not found")
  }
  // return [found, minCol, maxCol]
  return false;
}

// convwild (x:xs) = escapeRe [x] ++ convwild xs

function inside(s, t) {
  return before(t[0],t[1],s[0],s[1]) && after(t[2],t[3],s[2],s[3])
}

function strictly_inside(s, t) {
  return inside(s, t) && !same_span(s,t)
}

function same_span(s,t) {
  return (s[0] == t[0]) && (s[1] == t[1]) && (s[2] == t[2]) && (s[3] == t[3])
}

function before(r,c, s,t) {
  return  (r < s) || ((r == s) && (c <= t))
}

function after(r,c, s,t) {
  return  (r > s) || ((r == s) && (c >= t))
}

function innermost_span(spans) {
  if (spans.length > 0) {
    var best = spans[0], besti = 0
 
    for (var i = 1; i < spans.length; i++) {
      if (inside(spans[i], best)) {
        best = spans[i]
        besti = i
      }
    }
    for (var i = 0; i < spans.length; i++) {
      if (i == besti) {
        console.log("best ->", spans[i])
      } else {
        console.log("       ", spans[i])
      }
    }
  } else {
    console.log("innermost_span - no spans")
  }
}

function find_spans(line, minCol, maxCol) {
  if (!typed_spans) {
    console.log("typed_spans not loaded")
    return
  }
  var matches = [], len = typed_spans.length
  
  for (var i = 0; i < len; i++) {
    var span = typed_spans[i]
    if (!before(span[0], span[1], line, minCol)) continue
    if (!after(span[2], span[3], line, maxCol)) continue
    matches.push(span)
  }
  return matches
}

function atLineStart(elt) {
  if (elt.tagName == "A") {
    var name = elt.getAttribute("name")
    if (name) {
      var m = name.match(/^line-(\d+)/)
      if (m) {
        return m[1]
      }
    }
  }
  return 0
}

// find the next larger span
function grow_span(span) {
  var best
  for (var i = 0; i < typed_spans.length; i++) {
    var t = typed_spans[i]
    if (strictly_inside(span, t)) {
      if (!best || inside(t, best)) {
        best = t
      }
    }
  }
  return best
}

function show_line_spans(lineno) {
  var text = extract_line(lineno)
  var spans = []
  for (var i = 0; i < typed_spans.length; i++) {
    var s = typed_spans[i]
    if (s[0] == lineno && s[2] == lineno) {
      spans.push(s)
    }
  }
  console.log("spans found:", spans.length)
  for (var i = 0; i < spans.length; i++) {
    var s = spans[i]
    console.log(s, "-->", text.substring(s[1]-1, s[3]-1) ) 
  }
}

function extract_line(lineno) {
  var q = "a[name=line-" + lineno + ']'
  var elt = document.querySelector(q)
  if (!elt) {
    console.log("line", lineno, "not found")
    return
  }
  elt = elt.nextSibling
  var text = []
  visit_siblings(text, elt)
  return text.join("")
}

function visit_children(text, elt) {
    if (!elt) return 0
    if (elt.nodeType == 3) {
      text.push(elt.textContent)
      return 1
    }

    if (atLineStart(elt)) return 0

    // visit any children
    for (var i = 0; i < elt.childNodes.length; i++) {
      if (visit_children(text, elt.childNodes[i]) == 0) return 0
    }
    return 1
}

function visit_siblings(text, elt) {
  while (elt) {
    if (elt.nodeType == 3) {
      text.push(elt.textContent)
    } else if (atLineStart(elt)) {
      return 0
    } else {
      if (visit_children(text, elt) == 0) return 0
    }
    elt = elt.nextSibling
  }
  return 0
}

window.onload = function () {
	var links = document.getElementsByTagName('a');
	for (var i = 0; i < links.length; i++) {
		var xdef = links[i].getAttribute("xdef")
    		if (xdef) {
			links[i].title = xdef
		} else {
			links[i].onmouseover = highlight(true);
			links[i].onmouseout = highlight(false);
		}
	}
  console.log("done with the anchors");

   var head= document.getElementsByTagName('head')[0];
   var script= document.createElement('script');
   script.type= 'text/javascript';
   script.src= 'spans/spans-System.Path.WildMatch.js';
   head.appendChild(script);

  // onkeypress = 
  document.onclick = function (e) { reportLocation(e); return false }
};

