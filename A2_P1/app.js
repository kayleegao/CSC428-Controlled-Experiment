// Number of targets
var numTargets = 0;
// Min/Max radius of targets
var minRadius = 0,
  maxRadius = 0;
// Min separation between targets
var minSep = 20;
// Canvas size
var w = 960,
  h = 500;
// Number of correct clicks and total clicks
var numCorrect = 0,
  numClick = 0;
// Number of conditions
var numCondition = 0;
// Experiment variables, modify or define your own vars here.
var participant = prompt("Please enter the participant number:", "");
var totalBlock = 5;
var currentBlock = 1;
var totalTrials = 5;
var currentTrial = 0;
var trialFileContent = "participant\ttrial\ttechnique\tsize\tnumber\ttime\taccuracy rate\n";
var trialStartTime;
var currentTechnique = "BUBBLE";
var currentSize = "SMALL";
var currentNumber = "FEW";
var areaRadius = 50;
var isStudyRunning = true;
var isRestBeforeBlock = true;

// Define the bubble cursor interface
var svg = d3.select("div").append("svg:svg").attr("width", w).attr("height", h);
// Make a white background rectangle
svg
  .append("rect")
  .attr("class", "backgroundRect")
  .attr("width", w)
  .attr("height", h)
  .attr("fill", "white")
  .attr("stroke", "black");
//Calculate the distance between two points
function distance(ptA, ptB) {
  var diff = [ptB[0] - ptA[0], ptB[1] - ptA[1]];
  return Math.sqrt(diff[0] * diff[0] + diff[1] * diff[1]);
}

// Initialize position and radius of all targets.
function initTargets(numTargets, minRadius, maxRadius, minSep) {
  var radRange = maxRadius - minRadius;
  var minX = maxRadius + 10,
    maxX = w - maxRadius - 10,
    xRange = maxX - minX;
  var minY = maxRadius + 10,
    maxY = h - maxRadius - 10,
    yRange = maxY - minY;

  // Make a vertices array storing position and radius of each
  // target point.
  var targets = [];
  for (var i = 0; i < numTargets; i++) {
    var ptCollision = true;
    while (ptCollision) {
      // Randomly choose position and radius of new target pt.
      var pt = [Math.random() * xRange + minX, Math.random() * yRange + minY];
      var rad = Math.random() * radRange + minRadius;

      // Check for collisions with all targets made earlier.
      ptCollision = false;
      for (var j = 0; j < targets.length && !ptCollision; j++) {
        var ptJ = targets[j][0];
        var radPtJ = targets[j][1];
        var separation = distance(pt, ptJ);
        if (separation < rad + radPtJ + minSep) {
          ptCollision = true;
        }
      }

      if (!ptCollision) {
        targets.push([pt, rad]);
      }
    }
  }
  return targets;
}

// Update the fillcolor of the targetcircles
function updateTargetsFill(currentCapturedTarget, clickTarget) {
  svg.selectAll(".targetCircles").attr("fill", function (d, i) {
    var clr = "white";
    if (i === currentCapturedTarget) {
      clr = "limegreen";
    }
    if (i === clickTarget) clr = "lightsalmon";
    if (i === clickTarget && i === currentCapturedTarget) clr = "darkred";
    return clr;
  });
}

// The following three getTargetCapturedBy* functions are used to
// calculate and render the cursor technique we will be using for
// the experiement.
function getTargetCapturedByBubbleCursor(mouse, targets) {
  if (!isStudyRunning) {
    svg
      .select(".cursorCircle")
      .attr("cx", mouse[0])
      .attr("cy", mouse[1])
      .attr("r", 0);
    svg.select(".cursorMorphCircle").attr("cx", 0).attr("cy", 0).attr("r", 0);
    return -1;
  }

  // Compute distances from mouse to center, outermost, innermost
  // of each target and find currMinIdx and secondMinIdx;
  var mousePt = [mouse[0], mouse[1]];
  var dists = [],
    containDists = [],
    intersectDists = [];
  var currMinIdx = 0;
  for (var idx = 0; idx < numTargets; idx++) {
    var targetPt = targets[idx][0];
    var currDist = distance(mousePt, targetPt);
    dists.push(currDist);
    targetRadius = targets[idx][1];
    containDists.push(currDist + targetRadius);
    intersectDists.push(currDist - targetRadius);
    if (intersectDists[idx] < intersectDists[currMinIdx]) {
      currMinIdx = idx;
    }
  }

  // Find secondMinIdx
  var secondMinIdx = (currMinIdx + 1) % numTargets;
  for (var idx = 0; idx < numTargets; idx++) {
    if (
      idx != currMinIdx &&
      intersectDists[idx] < intersectDists[secondMinIdx]
    ) {
      secondMinIdx = idx;
    }
  }

  var cursorRadius = Math.min(
    containDists[currMinIdx],
    intersectDists[secondMinIdx]
  );
  svg
    .select(".cursorCircle")
    .attr("cx", mouse[0])
    .attr("cy", mouse[1])
    .attr("r", cursorRadius);
  if (cursorRadius < containDists[currMinIdx]) {
    svg
      .select(".cursorMorphCircle")
      .attr("cx", targets[currMinIdx][0][0])
      .attr("cy", targets[currMinIdx][0][1])
      .attr("r", targets[currMinIdx][1] + 5);
  } else {
    svg.select(".cursorMorphCircle").attr("cx", 0).attr("cy", 0).attr("r", 0);
  }
  return currMinIdx;
}

function getTargetCapturedByPointCursor(mouse, targets) {
  //PointCursor tests if the point cursor is inside a target
  var mousePt = [mouse[0], mouse[1]];
  var capturedIdx = -1;
  for (var idx = 0; idx < numTargets; idx++) {
    var targetPt = targets[idx][0];
    var currDist = distance(mousePt, targetPt);
    targetRadius = targets[idx][1];
    if (currDist <= targetRadius) {
      capturedIdx = idx;
    }
  }
  svg
    .select(".cursorCircle")
    .attr("cx", mouse[0])
    .attr("cy", mouse[1])
    .attr("r", 0);
  svg.select(".cursorMorphCircle").attr("cx", 0).attr("cy", 0).attr("r", 0);
  return capturedIdx;
}

function getTargetCapturedByAreaCursor(mouse, targets) {
  // AreaCursor tests how many targets are captured by the area cursor.
  // If multiple targets are captured test if the center is inside a target.
  var mousePt = [mouse[0], mouse[1]];
  var capturedAreaIdx = -1;
  var capturedPointIdx = -1;
  var numCaptured = 0;
  for (var idx = 0; idx < numTargets; idx++) {
    var targetPt = targets[idx][0];
    var currDist = distance(mousePt, targetPt);
    targetRadius = targets[idx][1];
    if (currDist <= targetRadius + areaRadius) {
      capturedAreaIdx = idx;
      numCaptured++;
    }
    if (currDist <= targetRadius) capturedPointIdx = idx;
  }
  var capturedIdx;
  if (capturedPointIdx > -1) capturedIdx = capturedPointIdx;
  else if (numCaptured == 1) capturedIdx = capturedAreaIdx;

  var rad = areaRadius;
  if (!isStudyRunning) rad = 0;

  svg
    .select(".cursorCircle")
    .attr("cx", mouse[0])
    .attr("cy", mouse[1])
    .attr("r", rad)
    .attr("fill", "lightgray");

  svg.select(".cursorMorphCircle").attr("cx", 0).attr("cy", 0).attr("r", 0);

  return capturedIdx;
}


// Renders three lines of texts to indicate the study status.
function setStatusText(text1, text2, text3, text4, text5) {
  svg.select(".studyStatusText1").text(text1);
  svg.select(".studyStatusText2").text(text2);
  svg.select(".studyStatusText3").text(text3);
  svg.select(".studyStatusText4").text(text4);
  svg.select(".studyStatusText5").text(text5);
}

// Below initiates neccesary UI elements for the study.
// Make the targets
var targets = initTargets(numTargets, minRadius, maxRadius, minSep);
// Choose the target that should be clicked
var clickTarget = Math.floor(Math.random() * targets.length);
svg
  .append("text")
  .attr("class", "studyStatusText1")
  .attr("x", 20)
  .attr("y", 20)
  .text("Cursor Set to " + currentTechnique);
svg
  .append("text")
  .attr("class", "studyStatusText2")
  .attr("x", 20)
  .attr("y", 40)
  .text("Size of Targets Set to " + currentSize);
svg
  .append("text")
  .attr("class", "studyStatusText3")
  .attr("x", 20)
  .attr("y", 60)
  .text("Number of Targets Set to " + currentNumber);
svg
  .append("text")
  .attr("class", "studyStatusText4")
  .attr("x", 20)
  .attr("y", 80)
  .text("Click to Begin Block " + currentBlock + " of " + totalBlock);
svg
  .append("text")
  .attr("class", "studyStatusText5")
  .attr("x", 20)
  .attr("y", 100)
  .text("The block has " + totalTrials + " Trials");
// Add in the cursor circle at 0,0 with 0 radius
// We add it first so that it appears behind the targets
svg
  .append("circle")
  .attr("class", "cursorCircle")
  .attr("cx", 0)
  .attr("cy", 0)
  .attr("r", 0)
  .attr("fill", "lightgray");
//  Add in cursorMorph circle  at 0,0 with 0 radius.
//  We add it first so that it appears behind the targets
svg
  .append("circle")
  .attr("class", "cursorMorphCircle")
  .attr("cx", 0)
  .attr("cy", 0)
  .attr("r", 0)
  .attr("fill", "lightgray");

// Below binds events to UI elements to implement the study work flow.
// Handle mousemove events. There should be different visuals preseneted when moving the cursor.
svg.on("mousemove", function (d, i) {
  var capturedTargetIdx;
  if (currentTechnique == "BUBBLE")
    capturedTargetIdx = getTargetCapturedByBubbleCursor(
      d3.mouse(this),
      targets
    );
  else if (currentTechnique == "POINT")
    capturedTargetIdx = getTargetCapturedByPointCursor(d3.mouse(this), targets);
  else if (currentTechnique == "AREA")
    capturedTargetIdx = getTargetCapturedByAreaCursor(d3.mouse(this), targets);
  // Update the fillcolor of the targetcircles
  updateTargetsFill(capturedTargetIdx, clickTarget);
});

// Handle a mouse click. Mouse clicks have different effect depending on the study status
svg.on("click", function (d, i) {
  // If current status is the rest before a block, a click would initiate new target circles and start the study.
  if (isRestBeforeBlock) {
    isRestBeforeBlock = false;
    setStatusText("", "", "", "", "");
    isStudyRunning = true;
    var d = new Date();
    trialStartTime = d.getTime();
    // Set size of targets. 
    if (currentSize == "SMALL") {
      minRadius = 5;
      maxRadius = 15;
    }
    else if (currentSize == "MEDIUM") {
      minRadius = 15;
      maxRadius = 25;
    }
    else if (currentSize == "LARGE") {
      minRadius = 25;
      maxRadius = 35;
    }
    // Set number of targets. 
    if (currentNumber == "FEW") {
      numTargets = 10;
    }
    else if (currentNumber == "SOME") {
      numTargets = 25;
    }
    else if (currentNumber == "MANY") {
      numTargets = 40;
    }
    // Make the targets
    targets = initTargets(numTargets, minRadius, maxRadius, minSep);
    // Choose the target that should be clicked
    clickTarget = Math.floor(Math.random() * targets.length);
    // Add in the target circles
    svg
      .selectAll("targetCircles")
      .data(targets)
      .enter()
      .append("circle")
      .attr("class", "targetCircles")
      .attr("cx", function (d, i) {
        return d[0][0];
      })
      .attr("cy", function (d, i) {
        return d[0][1];
      })
      .attr("r", function (d, i) {
        return d[1] - 1;
      })
      .attr("stroke-width", 2)
      .attr("stroke", "limegreen")
      .attr("fill", "white");
    svg.select(".cursorCircle").style("visibility", function () {
      return "visible";
    });
    svg.select(".cursorMorphCircle").style("visibility", function () {
      return "visible";
    });
    // Update the fill color of the targets
    updateTargetsFill(-1, clickTarget);
  }
  // Otherwise if the current status is study-running, a click should be handled based on currentTechnique .
  else if (isStudyRunning) {
    var capturedTargetIdx;
    if (currentTechnique == "BUBBLE")
      capturedTargetIdx = getTargetCapturedByBubbleCursor(
        d3.mouse(this),
        targets
      );
    else if (currentTechnique == "POINT")
      capturedTargetIdx = getTargetCapturedByPointCursor(
        d3.mouse(this),
        targets
      );
    else if (currentTechnique == "AREA") {
      capturedTargetIdx = getTargetCapturedByAreaCursor(
        d3.mouse(this),
        targets
      );
    }

    // If user clicked on the clickTarget then choose a new clickTarget
    if (capturedTargetIdx == clickTarget) {
      numCorrect ++;
      numClick ++;
      var newClickTarget = clickTarget;
      // Make sure newClickTarget is not the same as the current clickTarget
      while (newClickTarget == clickTarget)
        newClickTarget = Math.floor(Math.random() * targets.length);
      clickTarget = newClickTarget;

      // Calculate the time taken for a trial and append it to the trialFileContent string.
      var d = new Date();
      var trialEndTime = d.getTime();
      var trialTotalTime = trialEndTime - trialStartTime;
      trialFileContent =
        trialFileContent +
        participant +
        "\t" +
        currentTrial +
        "\t" +
        currentTechnique +
        "\t" +
        currentSize +
        "\t" +
        currentNumber +
        "\t" +
        trialTotalTime +
        "\t" +
        (numCorrect/numClick) +
        "\n";
      currentTrial++;
      if (currentTrial == totalTrials) {
        // A block is finished when currentTrial == totalTrials,
        // add a dashline to for data readability.
        trialFileContent += "------\n";

        if (currentBlock == totalBlock) {
          numCondition ++;
          if (numCondition < 27) {
            isRestBeforeBlock = true;
            numCorrect = 0;
            numClick = 0;
            currentBlock = 1;
            currentTrial = 0;
            if (numCondition == 1){
              currentTechnique="BUBBLE";
              currentSize="SMALL";
              currentNumber="SOME";
            }
            else if (numCondition == 2){
              currentTechnique="BUBBLE";
              currentSize="SMALL";
              currentNumber="MANY";
            }
            else if (numCondition == 3){
              currentTechnique="BUBBLE";
              currentSize="MEDIUM";
              currentNumber="FEW";
            }
            else if (numCondition == 4){
              currentTechnique="BUBBLE";
              currentSize="MEDIUM";
              currentNumber="SOME";
            }
            else if (numCondition == 5){
              currentTechnique="BUBBLE";
              currentSize="MEDIUM";
              currentNumber="MANY";
            }
            else if (numCondition == 6){
              currentTechnique="BUBBLE";
              currentSize="LARGE";
              currentNumber="FEW";
            }
            else if (numCondition == 7){
              currentTechnique="BUBBLE";
              currentSize="LARGE";
              currentNumber="SOME";
            }
            else if (numCondition == 8){
              currentTechnique="BUBBLE";
              currentSize="LARGE";
              currentNumber="MANY";
            }
            else if (numCondition == 9){
              currentTechnique="POINT";
              currentSize="SMALL";
              currentNumber="FEW";
            }
            else if (numCondition == 10){
              currentTechnique="POINT";
              currentSize="SMALL";
              currentNumber="SOME";
            }
            else if (numCondition == 11){
              currentTechnique="POINT";
              currentSize="SMALL";
              currentNumber="MANY";
            }
            else if (numCondition == 12){
              currentTechnique="POINT";
              currentSize="MEDIUM";
              currentNumber="FEW";
            }
            else if (numCondition == 13){
              currentTechnique="POINT";
              currentSize="MEDIUM";
              currentNumber="SOME";
            }
            else if (numCondition == 14){
              currentTechnique="POINT";
              currentSize="MEDIUM";
              currentNumber="MANY";
            }
            else if (numCondition == 15){
              currentTechnique="POINT";
              currentSize="LARGE";
              currentNumber="FEW";
            }
            else if (numCondition == 16){
              currentTechnique="POINT";
              currentSize="LARGE";
              currentNumber="SOME";
            }
            else if (numCondition == 17){
              currentTechnique="POINT";
              currentSize="LARGE";
              currentNumber="MANY";
            }
            else if (numCondition == 18){
              currentTechnique="AREA";
              currentSize="SMALL";
              currentNumber="FEW";
            }
            else if (numCondition == 19){
              currentTechnique="AREA";
              currentSize="SMALL";
              currentNumber="SOME";
            }
            else if (numCondition == 20){
              currentTechnique="AREA";
              currentSize="SMALL";
              currentNumber="MANY";
            }
            else if (numCondition == 21){
              currentTechnique="AREA";
              currentSize="MEDIUM";
              currentNumber="FEW";
            }
            else if (numCondition == 22){
              currentTechnique="AREA";
              currentSize="MEDIUM";
              currentNumber="SOME";
            }
            else if (numCondition == 23){
              currentTechnique="AREA";
              currentSize="MEDIUM";
              currentNumber="MANY";
            }
            else if (numCondition == 24){
              currentTechnique="AREA";
              currentSize="LARGE";
              currentNumber="FEW";
            }
            else if (numCondition == 25){
              currentTechnique="AREA";
              currentSize="LARGE";
              currentNumber="SOME";
            }
            else if (numCondition == 26){
              currentTechnique="AREA";
              currentSize="LARGE";
              currentNumber="MANY";
            }
            setStatusText(
              "Condition "+ numCondition +" Complete",
              "Click to continue to the next condition",
              "Cursor Set to " + currentTechnique,
              "Size of Targets Set to " + currentSize,
              "Number of Targets Set to " + currentNumber,
              "Click to Begin Block " + currentBlock + " of " + totalBlock,
              "The block has " + totalTrials + " Trials"
            );
            svg.selectAll(".targetCircles").remove();
            svg.select(".cursorCircle").style("visibility", function () {
              return "hidden";
            });
            svg.select(".cursorMorphCircle").style("visibility", function () {
              return "hidden";
            });
          }
          else {
            // Current condition is finished when currentBlock == totalBlock,
          var blob = new Blob([trialFileContent], {
            type: "text/plain;charset=utf-8;",
          });
          // Download the study data as a txt file.
          saveAs(
            blob,
            "P" + participant + "_data.txt"
          );
          // Clear the visualization.
          isStudyRunning = false;
          svg.selectAll(".targetCircles").remove();
          numTargets = 0;
          setStatusText(
            "Study Complete!",
            "Please Ensure the Data File Has Been Downloaded",
            ""
          );
          }
          
        }
        else {
          // Finished one block, the participants should be allowed to rest.
          setStatusText(
            "Block Complete!",
            "Click to continue to the next block",
            ""
          );
          isRestBeforeBlock = true;
          currentBlock += 1;
          currentTrial = 0;
          svg.selectAll(".targetCircles").remove();
          svg.select(".cursorCircle").style("visibility", function () {
            return "hidden";
          });
          svg.select(".cursorMorphCircle").style("visibility", function () {
            return "hidden";
          });
        }
      } else {
        // Still within a block, update drawing of targets and the trialStartTime.
        updateTargetsFill(capturedTargetIdx, clickTarget);
        trialStartTime = trialEndTime;
      }
    }
    else {
      numClick ++;
    }
  }
});
