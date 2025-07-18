---
title: Video Object Detection and Tracking
type: templates
category: Videos
cat: videos
order: 803
is_new: t
meta_title: Video Object Detection Data Labeling Template
meta_description: Template for detecting objects in videos with Label Studio for your machine learning and data science projects.
---

<img src="/images/templates/video-object-tracking.png" alt="" class="gif-border" width="552px" height="408px" />

Video object detection is aimed at detecting object in a video stream with bounding boxes, as opposed to [Image object detection](/templates/image_bbox.html) with static images.

Video object tracking is a further extension where detected objects are tracked as they move around video frames, in both spatial and temporal directions.
The illustrated templates provide both manual and automatic ways of tracking objects in videos. In addition to the new video player that supports frame-by-frame video object tracking, the latest release also features a new annotation user interface that is more efficient, ergonomic, and flexible.

<a href="https://app.humansignal.com/b/MTkx"
  target="_blank" rel="noopener" aria-label="Open in Label Studio" style="all:unset;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;border-radius:4px;border:1px solid rgb(109,135,241);padding:8px 12px;background:rgb(87 108 193);color:white;font-weight:500;font-family:sans-serif;gap:6px;transition:background 0.2s ease;" onmouseover="this.style.background='rgb(97 122 218)'" onmouseout="this.style.background='rgb(87 108 193)'">
  <svg style="width:20px;height:20px" viewBox="0 0 26 26" fill="none"><path fill="none" d="M3.5 4.5h19v18h-19z"/><path fill-rule="evenodd" clip-rule="evenodd" d="M25.7 7.503h-7.087V5.147H7.588V2.792h11.025V.436H25.7v7.067Zm-18.112 0H5.225v10.994H2.863V7.503H.5V.436h7.088v7.067Zm0 18.061v-7.067H.5v7.067h7.088ZM25.7 18.497v7.067h-7.088v-2.356H7.588v-2.355h11.025v-2.356H25.7Zm-2.363 0V7.503h-2.363v10.994h2.363Z" fill="white"/></svg>
  <span style="font-size:14px">Open in Label Studio</span>
  <svg style="width:16px;height:16px" viewBox="0 0 24 24"><path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z" fill="white"/></svg>
</a>

!!! attention "important"

    1. Video classification and object tracking were available to preview prior to Label Studio version 1.6, but these features are now fully functional and production-ready. 
    2. In Label Studio Enterprise, the video object tracking is called video labeling for video object detection. 
    3. The supported video formats are `mpeg4/H.264 webp` and `webm`. The supported video format also depends on the browser, and any pre-conversions from the customer's side. 


## Prerequisites 

The prerequisites to use the video object detection feature are as follows:

1. Prepare the data set that must be labeled.
2. Use the data label and tool that supports it. 
3. Use the video player that is available for the video classification.
4. Put all the bounding boxes onto the screen.


## Key features supported 

The following key features are supported by the video player:

* The video and object detection use case using the bounding box on the video. 
* Video segmentation for the video by creating rectangles on the video.


## Labeling Configuration

The simplest way to get object detection and tracking project is to specify the following labeling configuration in your project settings.

```xml
  <View>
     <Header>Label the video:</Header>
     <Video name="video" value="$video" framerate="25.0"/>
     <VideoRectangle name="box" toName="video" />
     <Labels name="videoLabels" toName="video" allowEmpty="true">
       <Label value="Man" background="blue"/>
       <Label value="Woman" background="red"/>
       <Label value="Other" background="green"/>
     </Labels>
  </View>
```


## About the labeling configuration

All labeling configurations must be wrapped in [View](/tags/view.html) tags.

You can add a [header](/tags/header.html) to provide instructions to the annotator:
```xml
<Header>Label the video:</Header>
```

Use the [Video](/tags/video.html) object tag to specify the video data. The `framerate` parameter sets the frame rate of all videos in the project. Check all available parameters on the tag page reference. 
```xml
<Video name="video" value="$video" frameRate="25.0"/>
```

!!! note
    Ensure the `frameRate` matches the video's framerate. If your video has defects or variable framerate, it might cause discrepancies. Transcoding the video to a constant framerate before uploading can help. 
     
Use the [VideoRectangle](/tags/videorectangle.html) control tag to allow annotators to add rectangles to video frames:
```xml
<VideoRectangle name="box" toName="video" />
```

Use the [Labels](/tags/labels.html) control tag to specify labels that can be added to the rectangle regions added to the video frames:
```xml
<Labels name="videoLabels" toName="video" allowEmpty="true">
    <Label value="Man" background="blue"/>
    <Label value="Woman" background="red"/>
    <Label value="Other" background="green"/>
</Labels>
```
You can replace and add more labels inside `<Labels>` section that correspond to your annotation scenario.


## Input data

The input data by means of video stream URL is specified by `value` attribute in the `<Video>` tag. 
For the example above, the following [importing JSON format](/guide/tasks.html#Basic-Label-Studio-JSON-format) is expected:

```json
{
  "video": "https://htx-pub.s3.amazonaws.com/samples/opossum_snow.mp4"
}
```

## Output data

The annotated data consists of manually created keyframes, as well as optionally interpolated keyframes. Here is a JSON schema explained:

| JSON key | type | Description |
| --- | --- | --- |
| id | string | region (tracked object) ID | 
| type | string | "videorectangle" | 
| value.labels | list of strings | object label(s) | 
| value.duration | numeric | total duration of object lifespan in video stream (in seconds) |
| value.sequence | list of objects | list of keyframes |

The keyframe format inside `value.sequence` list is the following:

| JSON key | type | Description |
| --- | --- | --- |
| x | numeric | x-axis bounding box coordinate (top-left corner orientation with left to right stride) |
| y | numeric | y-axis bounding box coordinate (top-left corner orientation with top to bottom stride) |
| time | numeric | keyframe time absolute time position (in seconds) |
| frame | numeric | keyframe index position (in frames starting from 0) |
| width | numeric | bounding box width in the current frame |
| height | numeric | bounding box height in the current frame |
| rotation | numeric | bounding box rotation angle in the current frame (clock-wise) |
| enabled | boolean | Whether the consequent frames interpolation is toggled on / off (for example, to label occlusion) |

### Example

```json
{
  "id": "d1111333b6",
  "type": "videorectangle",
  "value": {
    "labels": [
      "Other"
    ],
    "duration": 11.96,
    "sequence": [
      {
        "x": 46.71875,
        "y": 6.944444444444445,
        "time": 0.04,
        "frame": 1,
        "width": 4.0625,
        "height": 23.61111111111111,
        "enabled": true,
        "rotation": 0
      },
      {
        "x": 46.640625,
        "y": 6.666666666666667,
        "time": 0.24,
        "frame": 6,
        "width": 4.140625,
        "height": 23.88888888888889,
        "enabled": true,
        "rotation": 0
      }
    ],
    "framesCount": 299
  },
  "origin": "manual",
  "to_name": "video",
  "from_name": "box"
}
```

### Exporting with interpolated frames

By default, only keyframes are included when exporting data. 

When exporting your annotations, you may want to include interpolated frames. This would ensure that every frame in the video is included.  

You can accomplish this by using the `interpolate_key_frames` parameter and one of the following methods:


#### Use the API to create an export snapshot with interpolation enabled 

You can use the Label Studio API to create an export snapshot with keyframe interpolation enabled.

**Endpoint:**
```
POST /api/projects/{project_id}/exports
```
**Request Body:**
```json
{
  "title": "Export with Interpolated Keyframes",
  "serialization_options": {
    "interpolate_key_frames": true
  }
}
```
**Example cURL Command:**
```bash
curl -X POST 'https://your-label-studio-domain.com/api/projects/{project_id}/exports' \
  -H 'Authorization: Token YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  --data-raw '{
    "title": "Export with Interpolated Keyframes",
    "serialization_options": {
      "interpolate_key_frames": true
    }
  }'
```
**Steps:**
1. **Create export snapshot:**
   - Send a `POST` request to `/api/projects/{project_id}/exports` with `interpolate_key_frames` set to `true` in the `serialization_options`.
2. **Check export status:**
   - Poll the export status using `GET /api/projects/{project_id}/exports/{export_id}` until the `status` is `completed`.
3. **Download the export:**
   - Once the export is completed, download the export file using:
     ```
     GET /api/projects/{project_id}/exports/{export_id}/download?exportType=JSON
     ```
   - Example cURL Command:
     ```bash
     curl -X GET 'https://your-label-studio-domain.com/api/projects/{project_id}/exports/{export_id}/download?exportType=JSON' \
       -H 'Authorization: Token YOUR_API_KEY' \
       -o 'exported_annotations.json'
     ```

#### Use the Label Studio SDK

If you're using the Label Studio SDK, you can create an export with interpolation enabled:

**Python code example:**

```python
from label_studio_sdk import Client
import time
# Connect to Label Studio
ls = Client(url='http://localhost:8080', api_key='YOUR_API_KEY')
# Get your project by ID
project = ls.get_project(PROJECT_ID)
# Create an export snapshot with interpolation enabled
export_result = project.export_snapshot_create(
    title='Export with Interpolated Keyframes',
    serialization_options={
        'interpolate_key_frames': True
    }
)
# Get the export ID
export_id = export_result['id']
# Wait for the export to complete
while True:
    export_status = project.get_export_status(export_id)
    if export_status['status'] == 'completed':
        break
    elif export_status['status'] == 'failed':
        raise Exception('Export failed')
    else:
        time.sleep(5)  # Wait for 5 seconds before checking again
# Download the export
export_file_path = project.export_snapshot_download(
    export_id, export_type='JSON', path='.'
)
print(f'Exported data saved to {export_file_path}')
```

**Notes:**
- Replace `YOUR_API_KEY` with your actual API key.
- Replace `PROJECT_ID` with your project ID.
- Ensure that you have installed the latest version of the Label Studio SDK.

#### Use the Command Line Interface (CLI)

You can use the Label Studio CLI to export annotations with interpolated keyframes.

**Command:**
```bash
label-studio export --host http://localhost:8080 --api-key YOUR_API_KEY PROJECT_ID JSON --interpolate-key-frames
```
**Notes:**
- The `--interpolate-key-frames` flag enables interpolation during export.
- Replace `YOUR_API_KEY` and `PROJECT_ID` with your API key and project ID, respectively.
- The exported data will be saved in the `data/export` directory by default.


#### Use the export endpoint with query parameter

You can directly export tasks with interpolation by using the export endpoint and passing `interpolate_key_frames` as a query parameter.
**Endpoint:**
```
GET /api/projects/{project_id}/export?interpolate_key_frames=true
```
**Example cURL Command:**
```bash
curl -X GET 'https://your-label-studio-domain.com/api/projects/{project_id}/export?interpolate_key_frames=true' \
  -H 'Authorization: Token YOUR_API_KEY' \
  -o 'exported_annotations.json'
```

## Label Studio UI enhancements

The video player functionality includes the following UI enhancements:
1. Dual ‘Region’ and ‘Details’ control panels vs. a single sidebar, allowing annotators to view all pertinent information about the task without scrolling.
2. Collapsible, draggable and resize-able panels for annotators to customize their workspace, especially useful to view images or video at a larger scale.
3. More granular controls for each region, including the ability to precisely set bounding box width, height and coordinates to fit an object for pixel-perfect annotations.
4. A cleaner interface to group, organize regions, link, add metadata, and delete regions, plus new functionality to lock regions.


## Use cases 

The video player provides the following use cases: 
1. [Enhance images, making it easier for annotators to more precisely label blurry images](#enhance-images).
2. [Add keyframes and adjust bounding boxes between keyframes to easily transition bounding box shapes and positions](#add-keyframes).
3. [Select and label between timestamps on the video with improved timeline segmentation](#select-and-label-between-timestamps).
4. [Use optional hotkey-driven navigation for even greater granularity in tracking objects](#use-optional-hotkey-driven-navigation).
5. [Label and track objects across subsequent frames using the fine-grained control actions](#fine-grained-control-actions).
6. [Reconfigure annotation workspaces to simplify labeling larger tasks, including large images and longer videos with many regions](#reconfigure-annotation-workspaces).

Video object detection has analytics that are built on top of the video. For example, if you look at a video you will see the bounding boxes that have tracking objects on the video.

### Enhance images
In the Label Studio UI, the video interface presents the main video canvas with controls that allows annotators to more precisely label blurry images using the following operations:

**Zoom in, zoom out, zoom to fit, or zoom to 100%.**

<img src="../images/zoom-options.png" class="gif-border" />

<i>Figure 1: Zoom options. </i>


**Tracking zoom options.**
<img src="../images/video-object-tracking-zoom-options.png" class="gif-border" />
<i>Figure 2: Video object tracking zoom options. </i>


**Go to the previous keyframe.**
<img src="../images/go-to-previous-keyframe.png" class="gif-border" />
<i>Figure 3: Go to the previous keyframe button. </i>


**Go one step back.**
<img src="../images/go-one-step-back.png" class="gif-border" />
<i>Figure 4: Go one step back button. </i>


**Play and pause.** 
<img src="../images/play-pause.png" class="gif-border" />
<i>Figure 5: Play and pause button. </i>


**Go one step forward.**
<img src="../images/go-one-step-forward.png" class="gif-border" />
<i>Figure 6: Go one step forward button. </i>


**Go to the next keyframe.**
<img src="../images/goto-next-keyframe.png" class="gif-border" />
<i>Figure 7: Go to the next keyframe button. </i>


**Toggle timeline.** 
<img src="../images/toggle-timeline.png" class="gif-border" />
<i>Figure 8: Toggle timeline button. </i>


### Add keyframes
In the video player, you can see the number of frames, total frames, and the current one. You can navigate from one frame to the other or a specific frame number. During navigation, key points are added so that you can jump to previous key points or the previous frame. 


<img src="../images/total-frames-current-frame.png" class="gif-border" />
<i>Figure 9: Working with frames. </i>

You can collapse or expand the timeline and also use the timer option to set and adjust the time for a video. 
<img src="../images/time-frame.png" class="gif-border" />
<i>Figure 10: Navigate using time frames. </i>

You can also adjust the rectangle frame to detect the object region of interest. 
<img src="../images/adjust-rectangle-frame-for-obj-detection.png" class="gif-border" />
<i>Figure 11: Adjust rectangle frame for object detection. </i>

To detect the object on a badge, select the label and draw a rectangle on it.
<img src="../images/object-detection-badge.png" class="gif-border" />
<i>Figure 12: Object detection badge. </i>


### Use timestamps

When you work with timestamps or timelines, you can add a keyframe on the bounding box and start at a particular frame number. A thin line (goes to the end of the video while scrolling) represents the transition or lifespan of the bounding box. You can track a badge using one frame after another. 

<img src="../images/navigate-to-particular-framenumber.png" class="gif-border" />
<i>Figure 13: Navigate to a particular frame number. </i>

The grey rectangle and orange color diamond shape shows the selected keyframe. 
<img src="../images/keyframe-timeline-to-create-bb.png" class="gif-border" />
<i>Figure 14: Timeline for keyframes.</i>

### Navigate with hotkeys
Enable the hot-key driven navigation to enhance the granularity in tracking objects.

<img src="../images/enable-shortcut-keys.png" class="gif-border" />
<i>Figure15: Enable hotkey-driven navigation.</i>


### Fine-grained control actions
Label and track objects across subsequent frames using the fine-grained control actions.

**Shape transition**

Shape transition occurs when you adjust the bounding box and the new keyframe appears in the timeline. For example, you can add a new keyframe and adjust the bounding box to fit the badge. Then navigate from one frame (say frame number 30) back to a previous frame (frame number 17). Now, you will see the bounding box shape changes across those frames. This action will help to easily transition the bounding box shape and adjust to the tracked object. You can add more key points or a key point to every frame to track the transition more precisely. 

<img src="../images/adjust-rectangle-frame-for-obj-detection.png" class="gif-border" />
<i>Figure 16: Adjust the rectangle frame.</i>


**Monitor the lifespan**

When you are in a particular frame number and if the badge disappears then you don't need to track it anymore. 

<img src="../images/disappears-badge.png" class="gif-border" />
<i>Figure 17: Badge disappears.</i>

Now navigate to that particular frame number and press the **Toggle Interpolation** button. It will cut the interpolation here and the badge disappears. It shows only those frames that were added previously.

<img src="../images/activate-toggle-interpolation.png" class="gif-border" />
<i>Figure 18: Activate toggle interpolation.</i>

The disappeared badge in Figure 17 now reappears within the interpolation as you see in Figure 19. 
<img src="../images/badge-appear-within-interpolation.png" class="gif-border" />
<i>Figure 19: Badge appears within interpolation.</i>

**Transition frames**

If you don’t want to play video by itself, but prefer to see the transition of the frames then you can drag the frame indicator to see how it transitions, how frames appear, how they disappear, and so on. You can also set positions for the video by dragging the overview window that shows the current visible viewport. 

### Reconfigure annotation workspaces 
You can reconfigure the annotation workspaces to simplify labeling larger tasks, including large images and longer videos with many regions. This allows you to view more of the video portion, a wider space for the timeline, and the ability to see many keyframes and regions. 

You can add key points by toggling the key points. For example, if you accidentally moved the bounding box, and it is not in the right place, then you must remove the key points to reset it to the initial position. You can add many bounding boxes for object detection. 

<img src="../images/add-multiple-keyframes.png" class="gif-border" />
<i>Figure 20: Add multiple key points.</i>

Figure 21 shows the available bounding boxes (`Car`, `Airplane`, or `Possum`) that you can add for object detection and tracking.
<img src="../images/add-many-bb.png" class="gif-border" />
<i>Figure 21: Add many bounding boxes.</i>

A mini map shows separate lines for each added label region. In Figure 22, the mini map shows separate lines for each added `Car`, `Airplane`, or `Possum` label region. 
<img src="../images/mini-map-upto-5bb.png" class="gif-border" />
<i>Figure 22: Mini map for multiple regions.</i>

### Additional examples 
The following shows additional examples of the video object tracking feature. 
<img src="../images/videoplayer.png" class="gif-border" />
<i>Figure 23: Example 1 of video object tracking.</i>

Example of video object tracking feature with timestamp.
<video src="../images/video-1.mp4" controls="controls" style="max-width: 730px;" class="gif-border" />

<i>Figure 24: Example 2 of video object tracking with timestamp.</i>

Move the Outliner window in video player.
<video src="../images/video-2.mp4" controls="controls" style="max-width: 730px;" class="gif-border" />

<i>Figure 25: Example 3 of moving the outliner window in video player.</i>

## Related tags

- [Video](/tags/video.html)
- [VideoRectangle](/tags/videorectangle.html)
- [Labels](/tags/labels.html)