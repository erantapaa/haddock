
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

var typed_spans;     // will be loaded dynamically
var span_stack = []  // stack of spans
var current_tooltip; // currently displayed tooltip
var tooltip_xy;      // last location of the display tooltip

// A cursor to keep track of line and column positions
function Cursor() {
  this.lineno = undefined  // current line number
  this.column = undefined  // current column
  this.elt = undefined

  this.goto_line = function(n) {
    this.elt = find_line(n)
    this.lineno = n
    this.column = 0
    if (this.elt) { return true } else { return false }
  }

  // return the current left position
  this.lpos = function () {
    return this.column
  }

  // return the current right position
  this.rpos = function () {
    var len = this.elt.textContent.length
    return this.column + len
  }

  // advance - returns false if at end
  this.advance = function () {
    var len = this.elt.textContent.length
    this.elt = this.elt.nextSibling
    if (this.elt) {
      var ln = atLineStart(this.elt)
      if (ln) {
        this.lineno = ln
        this.column = 0
      } else {
        this.column += len
      }
      return true
    } else {
      return false
    }
  }
}

function test() {
  var c = new Cursor()
  c.goto_line(87)
  for (var i = 0; i < 30; i++) {
    var lpos = c.lpos(), rpos = c.rpos(), ln = c.lineno
    console.log("at line", ln, "lpos:", lpos, "rpos:", rpos, c.elt)
    if (!c.advance()) break
  }
}

function test2() {
  visit_span([87, 35, 87, 46], function(e,ln,lpos,rpos) {
    console.log("at a node", e)
    e.className = e.className + " highlighted"
  })
}

function report_span(e, ln, lpos, rpos) {
  console.log("at line", ln, "lpos:", lpos, "rpos:", rpos, e)
}

function highlight_node(e, ln, lpos, rpos) {
  if (!(e.className && (e.className.indexOf("highlighted") >= 0))) {
    e.className = e.className + " highlighted"
  }
}

function highlight_span(span) {
  visit_span(span, function (e,ln,lpos,rpos) {
    if (!(e.className && (e.className.indexOf("highlighted") >= 0))) {
      e.className = e.className + " highlighted"
    }
  });
}

function visit_span(span, f) {
  var start_line = span[0]
  var start_col = span[1]
  var end_line = span[2]
  var end_col = span[3]
  var c = new Cursor()
  c.goto_line(start_line)

  // advance to start position
  var count = 1000
  while (c.elt && (count > 0)) {
    count = count - 1
    if (before(c.lineno, c.rpos()+1, start_line, start_col)) {
      c.advance()
    } else {
      // console.log("breaking at rpos:", c.rpos()+1, "start_col:", start_col)
      break
    }
  }

  while (c.elt) {
    var lpos = c.lpos(), rpos = c.rpos(), ln = c.lineno
    // console.log("lpos:", lpos, "end_col:", end_col)
    if (after(ln, lpos+1, end_line, end_col)) break
    f(c.elt, c.lineno, lpos, rpos)
    c.advance()
  }
}

function textContentLength(elt) {
  if (elt) {
    var t = elt.textContent
    if (t) {
      return t.length
    }
  }
  return 0
}

// locate which line a node is on
function locate_line(elt) {
  var found
  var initlen = elt.textContent.length
  var textlen = 0
  var count = 10000
  var wentup = false

  while (count > 0 && elt) {
    count = count - 1
    // console.log("at", elt)
    if (elt.nodeType == 3) {
      textlen += textContentLength(elt)
    } else if (found = atLineStart(elt)) {
      break;
    } else if (!wentup) {
      textlen += textContentLength(elt)
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
    return [found, minCol, maxCol, elt]
  } else {
    return
  }
}

function handle_keypress(e) {
  var ch = (typeof e.which == "number") ? e.which : e.keyCode
  console.log("got char code:", ch)
  if (ch == 97) {           // 'a'
    grow_type_span()
  } else if (ch == 115) {   // 's'
    shrink_type_span()
  } else if (ch == 113) {   // 'q'
    remove_type_span()
  }
}

function handle_click(e) {
  var x = e.clientX, y = e.clientY, elt = document.elementFromPoint(x,y)
  if (!elt) {
    console.log("elt is null")
    return false
  }

  console.log("page x,y:", e.pageX, e.pageY)

  var loc = locate_line(elt)
  if (!loc) {
    console.log("unable to determine location")
    return
  }
  var found = loc[0], lpos = loc[1], rpos = loc[2]

  console.log("hit at line:", found, "lpos:", lpos, "rpos:", rpos)
  var spans = find_spans(found, lpos, rpos)

  if (spans.length == 0) {
    console.log("no spans found")
    remove_type_span()
    return
  }

  var s = innermost_span(spans)
  remove_type_span()  // clear any existing span

  if (s) {
    span_stack.unshift(s)
    update_span_dom(s, elt)
  } else {
    console.log("no span found")
  }
}

function shrink_type_span() {
  if (span_stack.length <= 1) {
    remove_type_span()
    return;
  }
  span_stack.shift()
  var s = span_stack[0]
  simple_unhighlight()
  update_span_dom(s)
}

function grow_type_span() {
  if (span_stack.length < 1) return

  var s = grow_span(span_stack[0])
  if (s) {
    span_stack.unshift(s)
    update_span_dom(s)
  } else {
    console.log("span not growable")
  }
}

function remove_type_span() {
  span_stack = []
  tooltip_remove()
  simple_unhighlight()
}

function update_span_dom(sp, elt) {
  highlight_span(sp)
  tooltip_display(sp[4], elt)
  console.log("type:", sp[4])
  console.log("span_stack:", span_stack)
}

// an event handle for clicks
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
    return best
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

// returns 0 if not at an <a name="line-..."> tag
// otherwise returns the line number
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

// return the <a name="line-..."> element
function find_line(lineno) {
  var q = "a[name=line-" + lineno + ']'
  var elt = document.querySelector(q)
  return elt
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

function extract_line(lineno, lpos, rpos) {
  var elt = find_line(lineno)
  var pos = 0
  var start, end;
  var count = 20
  while (count > 0 && elt) {
    count = count-1
    var len = elt.textContent.length
    // console.log("before, pos:", pos, "len:", len)
    if (pos+len < lpos) {
      elt = elt.nextSibling
      pos += len
      continue
    }
    // start collecting
    start = elt
    while (elt) {
      end = elt
      var len = elt.textContent.length
      if (pos+len < rpos) {
        pos += len
        elt = elt.nextSibling
        continue
      }
      break
    }
    break;
  }
  return [start, end]
}

function index_of_child(elt) {
  var i = 0
  while (elt) {
    elt = elt.previousSibling
    i = i + 1
  }
  return i
}

function first_text_sibling(elt) {
  while (elt) {
    if (elt.nodeType == 3) {
      return elt;
    }
    elt = elt.nextSibling
  }
  return
}

function simple_highlight(lineno, lpos, rpos) {
  var start_end = extract_line(lineno, lpos, rpos)
  var start = start_end[0]
  var end = start_end[1]
  var e = start
  while (e) {
    e.className += " highlighted"
    if (e == end) break
    e = e.nextSibling
  }
}

function simple_unhighlight() {
  var nodes = document.getElementsByClassName("highlighted")
  var len = nodes.length
  var arr = []
  for (var i = 0; i < len; i++) {
    arr.push(nodes[i])
  }
  for (var i = 0; i < len; i++) {
    arr[i].className = arr[i].className.replace(/ *highlighted */,'')
  }
}

function pushdown_unhighlight(node) {
  // make all of node's children part of node's parent
  // then delete node
  // XXX: not tested yet

  var par = node.parentNode
  var end = node.nextSibling
  var e
  while (e = node.firstChild) {
    var next = e.nextSibling
    if (end) {
      par.insertBefore(e, end)
    } else {
      par.addChild(e)
    }
    e = next
  }
}

function pushdown_highlight(lineno, lpos, rpos) {
  var nodes = extract_line(lineno, lpos, rpos)
  var start = nodes[0], end = nodes[1]

  if (!start || !end) {
    console.log("unable to extract line", lineno, lpos, rpos)
    return
  }

  if (!(start.parent === end.parent)) {
    console.log("start and end do not share the same parent")
    return
  }

  // check that end is reachable from start
  // via .nextSibling
  var ok = false
  { var e = start;
    var count = 100;
    while (count > 0 && e) {
      if (e == end) {
        ok = true
        break
      }
      count = count - 1
      e = e.nextSibling
    }
  }

  if (!ok) {
    console.log("unable to find end node")
    return
  }

  console.log("OK")

  var node = document.createElement('span')
  node.className = "highlighted"
  var par = start.parentNode

  if (!par) {
    console.log("par is undefined")
    return
  }

  var before = end.nextSibling
  var e = start
  while (e) {
    var next = e.nextSibling
    node.appendChild(e)
    if (e == end) break
    e = next
  }

  if (before) {
    par.insertBefore(node, before)
  } else {
    par.addChild(node)
  }

  return node
}

function elt_offset(elt) {
  var obj = elt.getBoundingClientRect();
  return {
    left: obj.left + document.body.scrollLeft,
    top: obj.top + document.body.scrollTop,
    width: obj.width,
    height: obj.height
  };
}

function test_click(e) {
  var x = e.clientX, y = e.clientY, elt = document.elementFromPoint(x,y)
  var bb = elt.getBoundingClientRect()
  console.log("x:", x, "y:", y, "bb:", bb)
}

function tooltip_display(content, elt) {
  // update tooltip_xy
  if (elt) {
    tooltip_xy = elt_offset(elt)
  }

  var tip_elt = document.getElementsByClassName("tooltip-container")[0];

  if (!tip_elt) {
    // create a new tooltip node

    var frag = document.createDocumentFragment(),
        xpos = tooltip_xy.left + tooltip_xy.width + 20 // assume this is set
        ypos = tooltip_xy.top - tooltip_xy.height - 20

        tooltipContainer = document.createElement('div');

    var bodyNode = document.getElementsByTagName("body")[0];
    frag.appendChild(tooltipContainer);
    tooltipContainer.className = "tooltip-container"
    tooltipContainer.style.cssText = 'left:'+xpos+'px;top:'+ypos+'px;';
    tooltipContainer.innerHTML = content

    bodyNode.appendChild(frag);
    current_tooltip = frag

    console.log("added tooltip at x:", xpos, "y:", ypos)

  } else {
    tip_elt.innerHTML = content
  }
}

function tooltip_remove() {
  tip_elt = document.getElementsByClassName("tooltip-container")[0];
  if (tip_elt) {
    var bodyNode = document.getElementsByTagName("body")[0];
    bodyNode.removeChild(tip_elt)
  }
}

function handle_click_tooltip(e) {
  create_tooltip(e, "This is a test!")
}

function create_tooltip(event, content) {
  // add a new node to the body
  var frag = document.createDocumentFragment(),
      tooltipContainer = document.createElement('div'),
      tooltipPosX = event.pageX,
      tooltipPosY = event.pageY;

  var bodyNode = document.getElementsByTagName("body")[0];

  frag.appendChild(tooltipContainer);
  tooltipContainer.className = "tooltip-container"
  tooltipContainer.style.cssText = 'left:'+tooltipPosX+'px;top:'+tooltipPosY+'px;';
  tooltipContainer.innerHTML = content;

 //  this.addEventListener('mouseout', hideTooltip);

  bodyNode.appendChild(frag);
}

function leafname(path) {
  return path.replace(/^.*(\\|\/|\:)/, '');
}

function load_script(url) {
   var head= document.getElementsByTagName('head')[0];
   var script= document.createElement('script');
   script.type= 'text/javascript';
   script.src= url;
   head.appendChild(script);
}

function initialize() {
  // called when the DOM is ready
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

  // Determine the module name form the page url

  var href = window.location.href
  var modname = leafname(href)
  modname = modname.replace(/\.html(#.*)?$/,'')
  var src_url = "type-spans-" + modname + ".js"

  console.log("loading", src_url)
  load_script(src_url)

  // set up event handlers
  document.onclick = function (e) { handle_click(e); return false }
  document.onkeypress = function (e) { handle_keypress(e); return false }
};

window.onload = initialize;

