# Streamdeck-Video-Player

Rick Astley's Never Gonna Give You Up, on the Streamdeck- [Full Size](https://gfycat.com/cautiousfantasticbergerpicard)

![](https://thumbs.gfycat.com/CautiousFantasticBergerpicard-size_restricted.gif)

## What it does:

Completely push the Streamdeck's LED Screen buttons to the limit by proccessing videos into the correct size and then playing them on the device.

## Methods:

The Streamdeck was designed at most to play small GIFs on the buttons. This program uses [this Streamdeck API](https://github.com/danieltian/stream-deck-api) to instead play whole videos.

Videos are first processed via [FFMPEG for node.js](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) to extact single frames to hit a target FPS when processing. The single frames are then processed via (ImageMagick [for node.js](https://www.npmjs.com/package/imagemagick) to the correct size to fit into the 16:9 frame of the streamdeck, with the space between the images.

##
Chainsaw Man Ending #3 - [Full Size](https://gfycat.com/euphoricimperfectbettong)

![](https://thumbs.gfycat.com/EuphoricImperfectBettong-size_restricted.gif)

## How to use

`index.js "./path/to/video.mp4"`

By default, this will process the video then play it on the stream deck.
There are 3 possible arguments to add:

`"./path/to/video.mkv" [Should Generate Frames] [Target FPS] [Should Play on Streamdeck when Finished]`

`[Should Generate Frames]` - If you have already generated the frames for a video, set to `false` to skip that part. Defaults to `true`.
`[Target FPS]` - An integer of the expected framerate you want to play - see Limitations section for more info. Defaults to `15`.
`[Should Play on Streamdeck when Finished]` - If you want to only generate frames, like on a computer that doesn't even have a streamdeck plugged in, set to `false`. Defaults to `true`.

For example, `"./path/to/video.mkv" false 15 true` would look for video.mkv's premade frames, then playback at 15fps.

## Limitations

- Playback FPS will struggle to be above 15fps. Short videos (10-15 seconds) may be better. Hence, it's recommended to not render at more than 15 FPS as 1) it will make playback look laggy and 2) it will take ages to create the video. You can render out at like 1 or 2 FPS for testing, which means it'll take way less time to generate the frames.
- Frame generation may take a long time. It's recommended to redownsize the video to at least 1080p before using this program to process.
- A 60 second clip at 15fps will create 900 frames. Each frame is then cutup into the 15 different mini-screens, meaning there are then 13,500 images. Processing these takes a long time, but, since each image is only 72x72px to fit on the streamdeck (which is what allows this to have over 3FPS at all too, bigger images way slow it down), it takes only around 200mb of HDD space.
- This has only been tested with the Streamdeck 2 as it's all I own. I do not know if earlier/older models have different sized buttons. The code would for sure need some changes to work on the XL.

## Programming Challenges

- Originally, the frames were split by using every_n_frames in FFMPEG. However, this caused complications when I wanted to allow selecting an FPS, instead of a divisor of the original video's FPS (for example, a 24fps video using every_n_frames could only have 24fps:every_1_frame, 12fps:every_2_frame, 6fps_every_3_frame. Instead, a different API for FFMPEG was used that allowed for more exact frame sections to be used, specifically by % into the video. So if we wanted 900 frames from our 60s 15fps video, it would calculate the percents by iterating from 1/900% to 900/900%. There was an issue here where trying to request 100+ frames at once was too long of a command for FFMPEG to process, so each request had to be made on its own, which is slower but was overall a small amount of the overall time.
- Generating the correct size images was of course a challenge (`createImage()` function), and getting the spacing between the buttons correct, otherwise the image appeared stretched. I did see videos online of people using this API to play a single video on a single button that was pretty laggy, hence my idea to try this project to improve upon that.

##

Bocchi the Rock Opening - [Full Size](https://gfycat.com/qualifiedsnoopybufeo)

![](https://thumbs.gfycat.com/QualifiedSnoopyBufeo-size_restricted.gif)
