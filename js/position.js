// module position

// ycoord_to_line
// best_placement

function ycoord_to_line(info, y) {
  // return the line number for a y coordinate
  var first = 1, count = info.nlines - 1
  while (count > 0) {
    var step = Math.floor(count / 2)
    var it = first + step
    if (info.line_top[it] + info.line_height[it] <=  y) {
      first = it+1
      count = count - (step+1)
    } else {
      count = step
    }
  }
  return first
}

function best_placement(info, x, y, bheight, bwidth, delta) {
  // find the best placement for a tool-tip box
  //
  // let (cx,cy) be the center of the toolbox
  // minimize distance from (x,y) to (cx,cy)

  var lineno = ycoord_to_line(info, y)

  var top_line = Math.min( Math.max(1, lineno+delta), info.nlines )

  // determine the best position for this value of top_line

  var top = info.line_top[top_line]
  var minleft = left_margin(info, top_line, top+bheight)

  var left = Math.max(minleft, x - bwidth / 2)

  return { "top": top, "left": left }

  /*
  remove_boxes()
  create_box(left, top, bwidth, bheight)
  create_box(x-5, y-5, 10, 10, "blue")
  */
}

function left_margin(info, lineno, endy) {
  // determine the minimum left margin for a box beginning on
  // on line lineno and ending ay y-coordinate endy

  var m = info.line_px_width[lineno]
  var i = lineno
  while (i <= info.nlines && info.line_top[i] <= endy) {
    m = Math.max( m, info.line_px_width[i] )
    i++
  }
  return m
}

function test_ycoord(info, y) {
  // test locate_line
  var lineno = ycoord_to_line(info, y)
  console.log("for y:", y, "lineno:", lineno)
  var start = Math.max(1, lineno-1)
  var end = Math.min(lineno+1, info.nlines)
  for (var i = start; i <= end; i++) {
    console.log("line:", i, "top:", info.line_top[i],
                  "top+height:", info.line_top[i] + info.line_height[i]
    )
  }
}

