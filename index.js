const streamDeckApi = require('./lib/stream-deck-api')
var ffmpeg = require('ffmpeg');
var im = require('imagemagick');
const fs = require('fs');
const fsExtra = require('fs-extra');
const process = require('process');
var path = require("path");
var f_ffmpeg = require('fluent-ffmpeg');

var theFrames = [] //will hold a string list of the frames created from our video
var currentFrame = 1; //current frame to display

var times = []; //used in true-fps calculation
var fps; //used in true-fps calculation

var videoFPS; //will be calculated when processing the video in ffmpeg
var videoMetaData; //will be calculated when processing the video in ffmpeg
var frameRateDivisor;
var finishedScreenshots = 0;

var streamDeck;

//expected ARGs: "./path/to/video.mp4" true 15 false
//1. path to file
//2. whether to regen frames or not - set to FALSE if this video has been processed before
//3. desired frame rate
//4. should it stop after processing, or attempt to play

//note: may also need node --max-old-space-size=XXXX(X) to run large animations.

const myArgs = process.argv.slice(2);

if(myArgs.length < 1)
{
	console.log("!! No video file specified !!")
	process.exit();
}

//Main Editable Section

var fileToUse = myArgs[0];
var shouldRegenFrames = myArgs.length > 1 ? eval(myArgs[1]) : true; //default true to gen
var targetFPS = myArgs.length > 2 ? myArgs[2] : 15; //default of 15
var processingOnly = myArgs.length > 3 ? eval(myArgs[3]) : false; //default false to directly play on the streamdeck

//End Main Editable Section

var extension = path.extname(fileToUse);
var file = path.basename(fileToUse,extension);
var directory = path.dirname(fileToUse);
var extractionLocation = directory + "/" + file + "/"; //creates a folder in the location of the input video with the same name as the video to hold the frames and then button images

if(!processingOnly)
{
	streamDeck = streamDeckApi.getStreamDeck() //initialize streamdeck api
	streamDeck.reset()
}

console.log("- - - - - - - - - - - - -")
console.log("Using file: " + fileToUse)
console.log("Detected extension: " + extension)
console.log("Filename: " + file)
console.log("Directory in: " + directory)
console.log("Output directory: " + extractionLocation)
console.log("Will generate frames? " + shouldRegenFrames)
console.log("Will play on streamdeck after? " + !processingOnly)
console.log("- - - - - - - - - - - - -")

const clearLastLine = () => { //https://stackoverflow.com/questions/32938213/is-there-a-way-to-erase-the-last-line-of-output
  process.stdout.moveCursor(0, -1) // up one line
  process.stdout.clearLine(1) // from cursor to end
}


if(shouldRegenFrames)
{
	fsExtra.emptyDirSync(extractionLocation); //clear out the destination folder
}

try 
{
	var processVideo = new ffmpeg(fileToUse);
	processVideo.then(function (video) 
	{
		videoFPS = video.metadata.video.fps;
		videoMetaData = video.metadata;
		
		var framesRaw = videoFPS * video.metadata.duration.seconds;
		var framesDesired = targetFPS * video.metadata.duration.seconds;
		
		frameRateDivisor = videoFPS/targetFPS;
		
		console.log("- - - - - - - - - - - - -")
		console.log("Detected video FPS: " + video.metadata.video.fps)
		console.log("Playback FPS: " + video.metadata.video.fps/frameRateDivisor)
		console.log("FPS Divisor: " + frameRateDivisor)
		console.log("Desired Frame Count: " + framesDesired)
		
		if(videoFPS < targetFPS)
		{
			console.log("Video FPS is " + videoFPS + " but desired FPS was " + targetFPS + ". Impossibru")
			process.exit()
		}
		
		if(shouldRegenFrames)
		{
			console.log("Now extracting frames... (Will take some time)")
			
			for (let index = 1; index <= framesDesired; index++) 
			{
				f_ffmpeg(fileToUse)
					.on('filenames', function(filenames) 
					{
						theFrames.push(filenames[0])
					})
					.on('end', function() 
					{
						finishedScreenshots++;
						clearLastLine()
						console.log('Frame-Screenshots taken - ' + finishedScreenshots + "/" + framesDesired);
						if(finishedScreenshots == framesDesired)
						{
							processImages()
						}
					})
					.screenshots({
						timestamps: [(index/framesDesired)*100+"%"],
						folder: extractionLocation,
						//size: '1920x1080',
						filename: file + "_" + index + ".jpg",
				});
			}
			
			/*
			//will extract the frames of the video to the specified location. every_n_frames will skip frames from the original, hence letting the video play slower on the stream deck
			video.fnExtractFrameToJPG(extractionLocation, 
			{
				//every_n_frames : frameRateDivisor
				//every_n_seconds: 1/((60*60*60)/targetFPS)
				every_n_percentage: 1
			}, function (error, files) 
			{
				if (!error)
					theFrames = files; //saves an array of processed frames, just by filename (not any kind of image format). mostly used for image count. note that the list is not in proper order
					processImages()
			});
			*/
		}
		else
		{
			console.log("Scanning for existing frames in: " + extractionLocation)
			fs.readdir(extractionLocation, function (err, files) { //scan where they should be
				var framesDetected = []
				
				files.forEach(function (tempFile) 
				{
					if(!tempFile.includes("_b_", file.length)) //if they don't include our _b_ button identifier at the end (using the overall filename.length to start searching), it's assumed an original frame file.
					{
						framesDetected.push(tempFile)
					}
				});
				
				
				theFrames = framesDetected;
				console.log("Found existing " + framesDetected.length + " existing frames")
				processImages()
			});
		}
	}, 
	function (err) 
	{
		console.log('Error: ' + err);
	});
} 
catch (e)
{
	console.log(e.code);
	console.log(e.msg);
}

function createImage(index, size, offsetX, offsetY, butt)
{
	im.convert([extractionLocation + file + "_" + index + ".jpg", //the file that was output by fnExtractFrameToJPG for this frame
		'-crop', size + 'x' + size +'+' + offsetX + '+' + offsetY, //cropping to the size of size x size, then the offsets starting from the top left of the image being 0,0
		"-background", "black", "-extent", size + 'x' + size,  //adds a black background if the video is too small or the wrong aspect ratio to fill the whole streamdeck
		'-resize', '72x72', //resize the image to the size of the streamdeck buttons, to save filesize and process faster when playing
		extractionLocation + file + "_" + index + "_b_" + butt + ".jpg"], //naming the button specific image, putting the frame and button #s in the filename
	function(err, stdout)
	{
		if (err) throw err;
	});
}

//to calculate actual playback FPS
function processFPS() //https://stackoverflow.com/questions/8279729/calculate-fps-in-canvas-using-requestanimationframe
{
	const now = performance.now();
    while (times.length > 0 && times[0] <= now - 1000) 
	{
      times.shift();
    }
    times.push(now);
    return times.length;
}

function processImages()
{
	clearLastLine()
	console.log("Number of frames created: " + theFrames.length)
	
	var buttonWidth = videoMetaData.video.resolution.w/5; //unused
	var buttonHeight = (videoMetaData.video.resolution.h*0.66)/3; //16:9 resolution based currently as that's what the streamdeck is. 
	
	var verticalOffset = (videoMetaData.video.resolution.h - (videoMetaData.video.resolution.h*0.86)) //14% of the stream deck's vertical height is the space between the buttons. this can be used to determine how big the gaps are.

	console.log("Button size from original video: " + buttonHeight.toFixed(2) + "px")
	console.log("Gap between buttons from original video: " + verticalOffset.toFixed(2) + "px")
	
	console.log("- - - - - - - - - - - - -")
	
	if(shouldRegenFrames)
	{
		console.log("Processing image: 0/"+theFrames.length)
		
		for (let index = 1; index < theFrames.length; index++) 
		{
			
			//generates the images for all 15 buttons, starting horizontally then wrapping.
			
			createImage(index, buttonHeight, 0, 0, 1)
			createImage(index, buttonHeight, (buttonHeight+verticalOffset), 0, 2)
			createImage(index, buttonHeight, (buttonHeight+verticalOffset)*2, 0, 3)
			createImage(index, buttonHeight, (buttonHeight+verticalOffset)*3, 0, 4)
			createImage(index, buttonHeight, (buttonHeight+verticalOffset)*4, 0, 5)
			
			createImage(index, buttonHeight, 0, (buttonHeight+verticalOffset), 6)
			createImage(index, buttonHeight, (buttonHeight+verticalOffset), (buttonHeight+verticalOffset), 7)
			createImage(index, buttonHeight, (buttonHeight+verticalOffset)*2, (buttonHeight+verticalOffset), 8)
			createImage(index, buttonHeight, (buttonHeight+verticalOffset)*3, (buttonHeight+verticalOffset), 9)
			createImage(index, buttonHeight, (buttonHeight+verticalOffset)*4, (buttonHeight+verticalOffset), 10)
			
			createImage(index, buttonHeight, 0, (buttonHeight+verticalOffset)*2, 11)
			createImage(index, buttonHeight, (buttonHeight+verticalOffset), (buttonHeight+verticalOffset)*2, 12)
			createImage(index, buttonHeight, (buttonHeight+verticalOffset)*2, (buttonHeight+verticalOffset)*2, 13)
			createImage(index, buttonHeight, (buttonHeight+verticalOffset)*3, (buttonHeight+verticalOffset)*2, 14)
			createImage(index, buttonHeight, (buttonHeight+verticalOffset)*4, (buttonHeight+verticalOffset)*2, 15)
			
			clearLastLine()
			console.log("Processing image: " + index + "/" + theFrames.length + " - " + ((index/theFrames.length)*100).toFixed(2) + "%")
		}
	}
	else
	{
		console.log("Using pre-generated button images")
	}
	
	
	console.log("- - - - - - - - - - - - -")
	if(processingOnly)
	{
		console.log("Finished Processing for " + fileToUse)
		process.exit()
	}
	else
	{
		console.log("Beginning play cycle:")
		setInterval(doCycle, 1000 / (videoFPS/frameRateDivisor)) //1000ms = 1  second, then multiply by our target FPS. For example, a 30fps video with a 2 frameRateDivisor has a goal playback of 15fps, so 1000 / 15 means a delay of 66.6667ms between each frame draw
		console.log("True FPS: 0") //write true FPS once so clearLastLine has something to clear.
	}
}

function doCycle()
{	
	for (let index = 1; index <= 15; index++) 
	{
		setFrame(currentFrame, index)
	}

	currentFrame++;
	if(currentFrame >= theFrames.length)
	{
		currentFrame = 1;
	}
	
	clearLastLine()
	console.log("True FPS: ~" + processFPS() + " - Progress: " + currentFrame + "/" + theFrames.length)
}

function setFrame(num, butt)
{
	streamDeck.drawImageFile(extractionLocation + file + "_" + currentFrame + "_b_" + butt + ".jpg", butt)
}
