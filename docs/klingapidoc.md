Kling AI Series 3.0 Model API Specification
The Kling 3.0 series model has been officially launched. For the complete documentation, please refer to Kling AI NEW API Specification; the current document will no longer be updated. Thank you for your understanding and support.

Document update record:
[2026.2.10] Text-to-Video and Image-to-Video support intelligent shot segmentation. The model intelligently segments content based on the prompt words to achieve a multi-shot effect. The relevant parameter is "multi_shot": "intelligence".
[2026.2.5] The advanced element supports binding voice. When generating videos, it is recommended to specify the vocie through the element for better results. Synchronize and update this document: retain only the parameters that are applicable to the new model.
[2026.2.3] 
1. Refine the billing strategy for specifying a particular voice, with a marginal cost of 2 additional units for consumption beyond the unspecified voice; this involves the kling-v3 video model.
2. Add the mutual exclusion relationship between reference video input and native audio generation; involving the kling-v3-omni video model.
3. Add restrictions on creating elements, and only elements customized through videos are supported for binding voice.
[2026.2.2] New Document.

Capability Map
Video Generationkling-v3-omni	
	std（3s～15s）	pro（3s～15s）
text to video	single-shot-video generation	✅	✅

	multi-shot-video generation	✅	✅

	voice control	❌	❌

	others	-	-
image to video	single-shot-video generation	✅	✅

	multi-shot-video generation	✅	✅

	start & end frame	✅	✅

	element control
（video character elements & multi-image elements）	✅	✅

	reference video	✅（only 3s～10s）	✅（only 3s～10s）

	voice control	❌	❌

	others	-	-kling-video-o1	
	std（3s～10s）	pro（3s～10s）
text to video	single-shot-video generation	✅（only 5s、10s）	✅（only 5s、10s）

	voice control	❌	❌

	others	-	-
image to video	single-shot-video generation
 （only start frame）	✅（only 5s、10s）	✅（only 5s、10s）

	start & end frame	✅	✅

	element control
（only multi-image elements）	✅	✅

	cideo reference
 (including multi-image elements)	✅	✅

	voice control	❌	❌

	others	-	-kling-v3	
	std（3～15s）	pro（3～15s）
text to video	single-shot-video generation	✅	✅

	multi-shot-video generation	✅	✅

	voice control	❌	❌

	others	-	-
image to video	single-shot-video generation （only start frame）	✅	✅

	multi-shot-video generation	✅	✅

	start & end frame	✅	✅

	element control
（video character elements & multi-image elements）	✅	✅

	motion control	（coming soon）	（coming soon）

	voice control	❌	❌

	others	-	-Image Generationkling-v3-omni	
	custom aspect ratio（1K/2K/4K）	intelligent aspect ratio
text to image	single-image generation	✅	✅

	others	-	-
image to image	single-image generation	✅	✅

	series-image generation	✅	✅

	element control
（only multi-image elements）	✅	✅

	others	-	-kling-image-o1	
	custom aspect ratio（1K/2K）	intelligent aspect ratio
text to image    	single-image generation	✅	-

	others	-	-
image to image	single-image generation	✅	✅

	element control
（only multi-image elements）	✅	✅

	others	-	-kling-v3	
	custom aspect ratio（1K/2K）	intelligent aspect ratio
text to image    	single-image generation	✅	-

	others	-	-
image to image	single-image generation	✅	-

	element control
（only multi-image elements）	✅	-

	others	-	-

API
Omni-Video - Create TaskProtocol	https
Request URL	/v1/videos/omni-video
Request Method	POST
Request Format	application/json
Response Format	application/jsonRequest HeaderField	Value	Description 
Content-Type	application/json	Data Exchange Format
Authorization	Authentication information, refer to API authentication	Authentication information, refer to API authenticationRequest BodyField	Type	Required Field	Default Value	Description 
model_name	string	Optional	kling-video-o1	Model Name
● Enum values：kling-video-o1, kling-v3-omni
multi_shot	boolean	Optional	false	Whether to generate multi-shot video
● true: the prompt parameter is invalid
● false: the shot_type parameter and the multi_prompt parameter are invalid
shot_type	string	Optional	None	Storyboard method
● Enum values：customize
● When the multi_shot parameter is set to true, the current parameter is required.
prompt	string	Optional	None	Text prompt words, which can include positive and negative descriptions
● The prompt words can be templated to meet different video generation needs.
The Omni model can achieve various capabilities through Prompt with elements, images, videos, and other content.
1. Specify a element, image, or video in the format of<<<>>, such as<<element_1>>>,<<<image_1>>>,<<<video_1>>>.
2. For more information, please refer to: Kling VIDEO 3.0 Omni Model User Guide
● Cannot exceed 2500 characters.
● When the multi_shot parameter is false or the shot-type parameter is intelligence, the current parameter must not be empty.
Different model versions support different scopes. For details, please refer to the capability map mentioned above.
multi_prompt	array	Optional	None	Information about each storyboard, such as prompts and duration
● Define the shot sequence number, corresponding prompt word, and duration through the index, prompt, and duration parameters, where:
	○ Supports up to 6 storyboards, with a minimum of 1 storyboard.
	○ The maximum length of the content for each storyboard 512. 
	○ The duration of each storyboard should not exceed the total duration of the current task, and it must not be less than 1.
	○ The sum of the durations of all storyboards equals the total duration of the current task.
● Load with key:value, details as follows:
"multi_prompt":[
	{
  	"index":int,
    "prompt": "string",
    "duration": "5"
  },
  {
  	"index":int,
    "prompt": "string",
    "duration": "5"
  }
]
● When the mult_shot parameter is set to true and the shot_type parameter is set to customize, the current parameter must not be empty.
image_list	array	Optional	None	Reference Image List
● Including reference images of the element, scene, style, etc., it can also be used as the start or end frame to generate videos; When generating a video as the start or end frame:
	○ Define whether the image is in the first and last frames using the type parameter: first_frame is the start frame, end_frame is the end frame.
		■ Currently does not support only the end frame, which means that when there is a end frame image, there must be a first frame image.
	○ When generating a video using the first frame or the first and last frames, video editing functions cannot be used.
● Load with key:value, details as follows:
"image_list":[
	{
  	"image_url":"image_url",
    "type":"first_frame"
  },
  {
  	"image_url":"image_url",
    "type":"end_frame"
  }
]
● Supports inputting image Base64 encoding or image URL (ensure accessibility).
● Supported image formats include.jpg / .jpeg / .png.
● The image file size cannot exceed 10MB, and the width and height dimensions of the image shall not be less than 300px, and the aspect ratio of the image should be between 1:2.5 ~ 2.5:1.
● The amount of reference image is related to whether there is refrence video and the amount of reference element:
	○ When there are reference video, the sum of the amount of reference image and the amount of reference element shall not exceed 4.
	○ When there is no reference video, the sum of the amount of reference image and the amount of reference element shall not exceed 7.
	○ Setting an end frame is not supported when there are more than 2 images.
● The value of image_url parameter must not be empty.
Different model versions support different scopes. For details, please refer to the capability map mentioned above.
element_list	array	Optional	None	Reference Element List
● Based on element ID configuration. Load with key:value, details as follows:
"element_list":[
	{
   	"element_id":long
  },
  {
   	"element_id":long
  }
]
● The amount of reference element is related to whether there is reference video and the amount of reference image:
	○  When using raw video from the first frame or raw video from the first and last frames, a maximum of 3 subjects is supported.
	○  When there is a reference video, the sum of the number of reference images and the number of reference subjects must not exceed 4, and the use of video subjects is not supported.
	○  When there is no reference video, the sum of the number of reference images and the number of reference subjects must not exceed 7.
● The elements are categorized into video customization element (named as video character elements) and image customization elements (named as Multi-Image Elements), each with distinct scopes of application. Please exercise caution in distinguishing between them.
● For more detailed information on the subject, please refer to: Kling Element Library User Guide.
Different model versions support different scopes. For details, please refer to the capability map mentioned above.
video_list	array	Optional	None	Reference Video, get link for uploaded video.
● It can be used as a reference video for feature or as a video to be edited, with the default being the video to be edited; Selective retention of video original sound.
	○ Distinguish reference video types based on the refer_type parameter: feature is the feature reference video, base is the video to be edited.
	○ When the reference video is a video to be edited, the start and end frames of the video cannot be defined.
	○ Select whether to keep the video original sound through the parameter keep_original_stound, with yes indicating retention and no indicating non retention; The current parameters also apply to the feature reference video.
● When there is a reference video, the value of the sound parameter can only be off.
● Load with key:value, details as follows:
"video_list":[
	{
  	"video_url":"video_url",
    "refer_type":"base",
    "keep_original_sound":"yes"
  }
]
● Only .mp4/.mov formats are supported.
● Only supports videos with a duration of ≥ 3 seconds and ≤ 10 seconds.
● Video resolution must be between 720px and 2160px (inclusive) in both width and height.
● Only supports videos with frame rates of 24 ~ 60 fps, the output result is 24 fps.
● Only supports 1 video can be uploaded, with a video size not exceeding 200MB.
● The value of video_url parameter must not be empty.
Different model versions support different scopes. For details, please refer to the capability map mentioned above.
sound	string	Optional	off	Is sound generated simultaneously when generating videos
● Enum values: on, off
Only V2.6 and subsequent versions of the model supports the current parameters
mode	string	Optional	pro	Video generation mode
● Enum values: std, pro
● std: Standard Mode, generating 720P videos, which is cost-effective
● pro: Professional Mode, generating 1080P videos, which is higher quality video output
Different model versions support different scopes. For details, please refer to the capability map mentioned above.
aspect_ratio	string	Optional	None	The aspect ratio of the generated video frame (width:height)
● Enum values：16:9, 9:16, 1:1
● This parameter is required when the first-frame reference or video editing features are not used.
duration	string	Optional	5	Video Length, unit: s (seconds)
● Enum values: 3，4，5，6，7，8，9，10，11，12，13，14，15:
	○ When using the video editing function ("refer_date": "base"), the output result is the same as the duration of the incoming video, and the current parameter is invalid. Calculate billing by rounding the input video duration to the nearest integer.
Different model versions support different scopes. For details, please refer to the capability map mentioned above.
watermark_info	array	Optional	None	Whether to generate watermarked results simultaneously
● Defined through the ENABLE parameter, load with key:value, details as follows:
"watermark_info": {
 	"enabled": boolean // "true" means generate, while "false" means non-generate 
}
● Custom watermark is not supported at this time.
callback_url	string	Optional	None	The callback notification address for the result of this task. If configured, the server will actively notify when the task status changes
● The specific message schema of the notification can be found in "Callback Protocol"
external_task_id	string	Optional	None	Customized Task ID
● Users can provide a customized task ID, which will not overwrite the system-generated task ID but can be used for task queries.
● Please note that the customized task ID must be unique within a single user account.Response Body
{
	"code": 0, //Error Codes；Specific definitions can be found in Error codes
  "message": "string", //Error information
  "request_id": "string", //Request ID, generated by the system, is used to track requests and troubleshoot problems
  "data":{
  	"task_id": "string", //Task ID, generated by the system
    "task_info":{ //Task creation parameters
    	"external_task_id": "string" //Customer-defined task ID
    }, 
    "task_status": "string", //Task status, Enum values：submitted、processing、succeed、failed
    "created_at": 1722769557708, //Task creation time, Unix timestamp, unit ms
    "updated_at": 1722769557708 //Task update time, Unix timestamp, unit ms
  }
}
Invocation examples
Image-to-video with multi-shot
curl --location 'https://xxx/v1/videos/omni-video/' \
--header 'Authorization: Bearer xxx' \
--header 'Content-Type: application/json' \
--data '{
    "model_name": "kling-v3-omni",
    "multi_shot": true,
    "shot_type": "customize",
    "prompt": "",
    "multi_prompt": [
      {
        "index": 1,
        "prompt": "In the early morning café, sunlight streams through the glass windows, casting its warmth on the wooden tabletop. Coffee cups exhale hot steam, while the background is filled with the indistinct chatter of customers. The camera gradually zooms in, focusing on a young couple <<<image_1>>> (male: 25 years old, with curly hair and wearing a light blue shirt; female: 23 years old, with a ponytail and wearing thin-framed glasses) seated across the table. Their fingers unconsciously touch the same poetry anthology.",
        "duration": "2"
      },
      {
        "index": 2,
        "prompt": "The girl was flipping through the pages of a book with her head down, while the boy <<<image_2>>> suddenly looked up. Their gazes met, causing the girl's cheeks to blush slightly and the boy's mouth to curve upwards. The camera panned through the two of them, capturing the retro clock hanging on the wall behind them (with the hands pointing to 9:15).",
        "duration": "3"
      }
    ],
    "image_list": [
      {
        "image_url": "xx"
      } ,
      {
        "image_url": "xxx"
      }
    ],
    "video_list": [],
    "mode": "pro",
    "sound": "on",
    "aspect_ratio": "16:9",
    "duration": "5",  
    "callback_url": "xx",
    "external_task_id": ""
  }'

Text-to-video with multi-shot
curl --location 'https://xxx/v1/videos/omni-video/' \
--header 'Authorization: Bearer xxx' \
--header 'Content-Type: application/json; charset=utf-8' \
--data '{
    "model_name": "kling-v3-omni",
    "multi_shot": true,
    "shot_type": "customize",
    "prompt": "",
    "multi_prompt": [
      {
        "index": 1,
        "prompt": "Two friends talking under a streetlight at night. Warm glow, casual poses, no dialogue.",
        "duration": "2"
      },
      {
        "index": 2,
        "prompt": "A runner sprinting through a forest, leaves flying. Low-angle shot, focus on movement.",
        "duration": "3"
      },
      {
        "index": 3,
        "prompt": "A woman hugging a cat, smiling. Soft sunlight, cozy home setting, emphasize warmth.",
        "duration": "3"
      },
      {
        "index": 4,
        "prompt": "A door creaking open, shadowy hallway. Dark tones, minimal details, eerie mood.",
        "duration": "3"
      },
      {
        "index": 5,
        "prompt": "A man slipping on a banana peel, shocked expression. Exaggerated pose, bright colors.",
        "duration": "3"
      },
      {
        "index": 6,
        "prompt": "A sunset over mountains, small figure walking away. Wide angle, peaceful atmosphere.",
        "duration": "1"
      }
    ],
    "image_list": [],
    "sound":"on",
    "element_list": [],
    "video_list": [],
    "mode": "pro",
    "aspect_ratio": "16:9",
    "duration": "15",
    "callback_url": "xxx",
    "external_task_id": ""
  }'

Omni-Video - Query Task (Single)Protocol	https
Request URL	/v1/videos/omni-video/{id}
Request Method	GET
Request Format	application/json
Response Format	application/jsonRequest HeaderField	Value	Description 
Content-Type	application/json	Data Exchange Format
Authorization	Authentication information, refer to API authentication	Authentication information, refer to API authenticationRequest Path ParametersField	Type	Required Field	DefaultValue	Description 
task_id	string	Optional	None	Task ID
● Request Path Parameters，directly fill the Value in the request path
● When creating a task, you can choose to query by external_task_id or task_id.
external_task_id	string	Optional	None	Customized Task ID
● Request Path Parameters，directly fill the Value in the request path
● When creating a task, you can choose to query by external_task_id or task_id.Request Body
None
Response Body
{
	"code": 0, //Error codes；Specific definitions can be found in "Error Code"
  "message": "string", //Error information
  "request_id": "string", //Request ID, generated by thTask ID, generated by the system is used to track requests and troubleshoot problems
  "data":{
  	"task_id": "string", //Task ID, generated by the system
    "task_status": "string", //Task status, Enum values：submitted、processing、succeed、failed
    "task_status_msg": "string", //Task status information, displaying the failure reason when the task fails (such as triggering the content risk control of the platform, etc.)
    "task_info":{ //Task creation parameters
    	"external_task_id": "string" //Customer-defined task ID
    },
    "watermark_info": {
    	"enabled": boolean
    },
    "final_unit_deduction": "string", // The deduction units of task
    "created_at": 1722769557708, //Task creation time, Unix timestamp, unit: ms
    "updated_at": 1722769557708, //Task update time, Unix timestamp, unit: ms
    "task_result":{
      "videos":[
        {
        	"id": "string", //Generated video ID; globally unique
      		"url": "string", //URL for generating videos，such as https://p1.a.kwimgs.com/bs2/upload-ylab-stunt/special-effect/output/HB1_PROD_ai_web_46554461/-2878350957757294165/output.mp4(To ensure information security, generated images/videos will be cleared after 30 days. Please make sure to save them promptly.)
      		"watermark_url": "string", //URL for generating videos with watermark，hotlink protection format
          "duration": "string" //Total video duration, unit: s (seconds)
        }
      ]
    }
  }
}

Omni-Video - Query Task (List)Protocol	https
Request URL	/v1/videos/omni-video
Request Method	GET
Request Format	application/json
Response Format	application/jsonRequest HeaderField	Value	Description 
Content-Type	application/json	Data Exchange Format
Authorization	Authentication information, refer to API authentication	Authentication information, refer to API authenticationQuery ParametersField	Type	Required Field	Default Value	Description 
pageNum	int	Optional	1	Page number
● Value range：[1,1000]
pageSize	int 	Optional	30	Data volume per page
● Value range：[1,500]Request Body
None
Response Body
{
	"code": 0, //Error codes；Specific definitions can be found in Error codes
  "message": "string", //Error information
  "request_id": "string", //Request ID, generated by the system,Task ID, generated by the systemgenerated by the systemto track requests and troubleshoot problems
  "data":[
    {
      "task_id": "string", //Task ID, generated by the system
      "task_status": "string", //Task status, Enum values：submitted、processing、succeed、failed
      "task_status_msg": "string", //Task status information, displaying the failure reason when the task fails (such as triggering the content risk control of the platform, etc.)
      "task_info":{ //Task creation parameters
    		"external_task_id": "string" //Customer-defined task ID
    	},
      "watermark_info": {
        "enabled": boolean
      },
    	"final_unit_deduction": "string", // The deduction units of task
      "created_at": 1722769557708, //Task creation time, Unix timestamp, unit: ms
    	"updated_at": 1722769557708, //Task update time, Unix timestamp, unit: ms
      "task_result":{
        "videos":[
          {
            "id": "string", //Generated video ID; globally unique
            "url": "string", //URL for generating videos，such as https://p1.a.kwimgs.com/bs2/upload-ylab-stunt/special-effect/output/HB1_PROD_ai_web_46554461/-2878350957757294165/output.mp4(To ensure information security, generated images/videos will be cleared after 30 days. Please make sure to save them promptly.)
	      		"watermark_url": "string", //URL for generating videos with watermark，hotlink protection format
            "duration": "string" //Total video duration, unit: s (seconds)
          }
        ]
    	}
    }
  ]
}

Text to Video - Create TaskProtocol	https
Request URL	/v1/videos/text2video
Request Method	POST
Request Format	application/json
Response Format	application/jsonRequest HeaderField	Value	Description 
Content-Type	application/json	Data Exchange Format
Authorization	Authentication information, refer to API authentication	Authentication information, refer to API authenticationRequest BodyField	Type	Required Field	Default	Description
model_name	string	Optional	kling-v1	Model Name
● Enum values：kling-v1, kling-v1-6, kling-v2-master, kling-v2-1-master, kling-v2-5-turbo, kling-v2-6, kling-v3
multi_shot	boolean	Optional	false	Whether to generate multi-shot video
● true: the prompt parameter is invalid
● false: the shot_type parameter and the multi_prompt parameter are invalid
shot_type	string	Optional	None	Storyboard method
● Enum values：customize, intelligence
● When the multi_shot parameter is set to true, the current parameter is required.
prompt	string	Optional	None	Positive text prompt
● The prompt words can be templated to meet different video generation needs.
The Omni model can achieve various capabilities through Prompt with elements, images, videos, and other content.
1. Specify a element, image, or video in the format of<<<>>, such as<<element_1>>>,<<<image_1>>>,<<<video_1>>>.
2. For more information, please refer to: Kling VIDEO 3.0 Model User Guide
● Cannot exceed 2500 characters.
● Use<<<voice_1>>>to specify the voice, with the same sequence as the voice referenced by the voice_list parameter.
● A video generation task can reference up to 2 tones at most; When specifying a tone, the sound parameter value must be on。
● The simpler the grammar structure, the better. For example: The man <<<voice_1>>> said, "Hello.".
● When the voice_ist parameter is not empty and the prompt parameter references the voice ID, the video generation task will be billed based on the "with voice generation" metric.
● When the multi_shot parameter is false or the shot-type parameter is intelligence, the current parameter must not be empty.
Different model versions support different scopes. For details, please refer to the capability map mentioned above.
multi_prompt	array	Optional	None	Each storyboard cue can include both positive and negative descriptions
● Define the shot sequence number, corresponding prompt word, and duration through the index, prompt, and duration parameters, where:
	○ Supports up to 6 storyboards, with a minimum of 1 storyboard.
	○ The maximum length of the prompt for each storyboard 512 characters.
	○ The duration of each storyboard should not exceed the total duration, but should not be less than 1.
	○ The sum of the durations of all storyboards equals the total duration of the current task.
● Load with key:value, details as follows:
"multi_prompt":[
	{
  	"index":int,
    "prompt": "string",
    "duration": "5"
  },
  {
  	"index":int,
    "prompt": "string",
    "duration": "5"
  }
]
● When the multi-shot parameter is set to true and the shot-type parameter is set to customize, the current parameter must not be empty
negative_prompt	string	Optional	Null	Negative text prompt
● Cannot exceed 2500 characters
● It is recommended to supplement negative prompt information through negative sentences directly within positive prompts.
voice_list	array	Optional	None	List of tones referenced when generating videos
● A video generation task can reference up to 2 voices at most.
● When the voice_ist parameter is not empty and the prompt parameter references the voice ID, the video generation task will be billed based on the "with voice generation" metric.
● The value of voice_id parameter is returned through the voice customization interface, or the official voices can be used. For details, please refer to the custom voice API, NOT the voice_id of Lip-Sync API.
● Load with key:value, details as follows:
"voice_list":[
  {"voice_id":"voice_id_1"},
  {"voice_id":"voice_id_2"}
]
sound	string	Optional	off	Is sound generated simultaneously when generating videos
● Enum values: on, off
Only V2.6 and subsequent versions of the model supports the current parameters.
cfg_scale	float	Optional	0.5	Flexibility in video generation; The higher the value, the lower the model's degree of flexibility, and the stronger the relevance to the user's prompt.
● Value range: [0, 1]
Only Kling-v1.x model supports the this parameters.
mode	string	Optional	std	Video generation mode
● Enum values: std, pro
● std: Standard Mode, generating 720P videos, which is cost-effective
● pro: Professional Mode, generating 1080P videos, which is higher quality video output
Different model versions support different scopes. For details, please refer to the capability map mentioned above.
aspect_ratio	string	Optional	16:9	The aspect ratio of the generated video frame (width:height)
● Enum values：16:9, 9:16, 1:1
duration	string	Optional	5	Video Length, unit: s (seconds)
● Enum values: 3，4，5，6，7，8，9，10，11，12，13，14，15
Different model versions support different scopes. For details, please refer to the capability map mentioned above.
watermark_info	array	Optional	None	Whether to generate watermarked results simultaneously
● Defined through the ENABLE parameter, the specific array format is as follows:
"watermark_info": {
 	"enabled": boolean // "true" means generate, while "false" means non-generate 
}
● Custom watermark is not supported at this time.
callback_url	string	Optional	None	The callback notification address for the result of this task. If configured, the server will actively notify when the task status changes
● The specific message schema of the notification can be found in "Callback Protocol"
external_task_id	string	Optional	None	Customized Task ID
● Users can provide a customized task ID, which will not overwrite the system-generated task ID but can be used for task queries.
● Please note that the customized task ID must be unique within a single user account.Response Body
{
	"code": 0, //Error codes；Specific definitions can be found in "Error Code"
  "message": "string", //Error information
  "request_id": "string", //Request ID, generated by the system
  "data":{
  	"task_id": "string", //Task ID, generated by the system
    "task_status": "string", //Task status, Enum values：submitted、processing、succeed、failed
    "task_info":{ //Task creation parameters
    	"external_task_id": "string" //Customer-defined task ID
    },
    "created_at": 1722769557708, //Task creation time, Unix timestamp, unit ms
    "updated_at": 1722769557708 //Task update time, Unix timestamp, unit ms
  }
}
Invocation examples
Text-to-video with multi-shot
curl --location 'https://xxx/v1/videos/text2video' \
--header 'Authorization: Bearer xxx' \
--header 'Content-Type: application/json' \
--data '{
    "model_name": "kling-v3",
    "prompt": "",
    "multi_prompt": [
        {
            "index": 1,
            "prompt": "Two friends talking under a streetlight at night.  Warm glow, casual poses, no dialogue.",
            "duration": "2"
        },
        {
            "index": 2,
            "prompt": "A runner sprinting through a forest, leaves flying.  Low-angle shot, focus on movement.",
            "duration": "3"
        },
        {
            "index": 3,
            "prompt": "A woman hugging a cat, smiling.  Soft sunlight, cozy home setting, emphasize warmth.",
            "duration": "3"
        },
        {
            "index": 4,
            "prompt": "A door creaking open, shadowy hallway.  Dark tones, minimal details, eerie mood.",
            "duration": "3"
        },
        {
            "index": 5,
            "prompt": "A man slipping on a banana peel, shocked expression.  Exaggerated pose, bright colors.",
            "duration": "3"
        },
        {
            "index": 6,
            "prompt": "A sunset over mountains, small figure walking away.  Wide angle, peaceful atmosphere.",
            "duration": "1"
        }
    ],
    "multi_shot": true,
    "shot_type": "customize",
    "duration": "15",
    "mode": "pro",
    "sound": "on",
    "aspect_ratio": "9:16",
    "callback_url": "",
    "external_task_id": ""
}'

Text to Video - Query Task (Single)Protocol	https
Request URL	/v1/videos/text2video/{id}
Request Method	GET
Request Format	application/json
Response Format	application/jsonRequest HeaderField	Value	Description 
Content-Type	application/json	Data Exchange Format
Authorization	Authentication information, refer to API authentication	Authentication information, refer to API authenticationRequest Path ParametersField	Type	Required Field	DefaultValue	Description 
task_id	string	Optional	None	Task ID for Text to Video
● Request Path Parameters，directly fill the Value in the request path
● When creating a task, you can choose to query by external_task_id or task_id.
external_task_id	string	Optional	None	Customized Task ID for Text-to-Video
● Request Path Parameters，directly fill the Value in the request path
● When creating a task, you can choose to query by external_task_id or task_id.Request Body
None
Response Body
{
	"code": 0, //Error codes；Specific definitions can be found in "Error Code"
  "message": "string", //Error information
  "request_id": "string", //Request ID, generated by thTask ID, generated by the system is used to track requests and troubleshoot problems
  "data":{
  	"task_id": "string", //Task ID, generated by the system
    "task_status": "string", //Task status, Enum values：submitted、processing、succeed、failed
    "task_status_msg": "string", //Task status information, displaying the failure reason when the task fails (such as triggering the content risk control of the platform, etc.)
    "task_info":{ //Task creation parameters
    	"external_task_id": "string" //Customer-defined task ID
    },
    "watermark_info": {
    	"enabled": boolean
    },
    "final_unit_deduction": "string", // The deduction units of task
    "created_at": 1722769557708, //Task creation time, Unix timestamp, unit: ms
    "updated_at": 1722769557708, //Task update time, Unix timestamp, unit: ms
    "task_result":{
      "videos":[
        {
        	"id": "string", //Generated video ID; globally unique
      		"url": "string", //URL for generating videos，such as https://p1.a.kwimgs.com/bs2/upload-ylab-stunt/special-effect/output/HB1_PROD_ai_web_46554461/-2878350957757294165/output.mp4(To ensure information security, generated images/videos will be cleared after 30 days. Please make sure to save them promptly.)
      		"watermark_url": "string", //URL for generating videos with watermark，hotlink protection format
          "duration": "string" //Total video duration, unit: s (seconds)
        }
      ]
    }
  }
}

Text to Video - Query Task (List)Protocol	https
Request URL	/v1/videos/text2video
Request Method	GET
Request Format	application/json
Response Format	application/jsonRequest HeaderField	Value	Description 
Content-Type	application/json	Data Exchange Format
Authorization	Authentication information, refer to API authentication	Authentication information, refer to API authenticationQuery ParametersField	Type	Required Field	DefaultValue	Description 
pageNum	int	Optional	1	Page number
● Value range：[1,1000]
pageSize	int 	Optional	30	Data volume per page
● Value range：[1,500]Request Body
None
Response Body
{
	"code": 0, //Error codes；Specific definitions can be found in Error codes
  "message": "string", //Error information
  "request_id": "string", //Request ID, generated by the system,Task ID, generated by the systemgenerated by the systemto track requests and troubleshoot problems
  "data":[
    {
      "task_id": "string", //Task ID, generated by the system
      "task_status": "string", //Task status, Enum values：submitted、processing、succeed、failed
      "task_status_msg": "string", //Task status information, displaying the failure reason when the task fails (such as triggering the content risk control of the platform, etc.)
      "task_info":{ //Task creation parameters
    		"external_task_id": "string" //Customer-defined task ID
    	},
      "watermark_info": {
        "enabled": boolean
      },
    	"final_unit_deduction": "string", // The deduction units of task
      "created_at": 1722769557708, //Task creation time, Unix timestamp, unit: ms
    	"updated_at": 1722769557708, //Task update time, Unix timestamp, unit: ms
      "task_result":{
        "videos":[
          {
            "id": "string", //Generated video ID; globally unique
            "url": "string", //URL for generating videos，such as https://p1.a.kwimgs.com/bs2/upload-ylab-stunt/special-effect/output/HB1_PROD_ai_web_46554461/-2878350957757294165/output.mp4(To ensure information security, generated images/videos will be cleared after 30 days. Please make sure to save them promptly.)
	      		"watermark_url": "string", //URL for generating videos with watermark，hotlink protection format
            "duration": "string" //Total video duration, unit: s (seconds)
          }
        ]
    	}
    }
  ]
}

Image to Video - Create TaskProtocol	https
Request URL	/v1/videos/image2video
Request Method	POST
Request Format	application/json
Response Format	application/jsonRequest HeaderField	Value	Description 
Content-Type	application/json	Data Exchange Format
Authorization	Authentication information, refer to API authentication	Authentication information, refer to API authenticationRequest BodyField	Type	Required Field	Default Value	Description 
model_name	string	Optional	kling-v1	Model Name
● Enum values：kling-v1, kling-v1-5, kling-v1-6, kling-v2-master, kling-v2-1, kling-v2-1-master, kling-v2-5-turbo, kling-v2-6, kling-v3
image	string	Optional 	Null	Reference Image
● Support inputting image Base64 encoding or image URL (ensure accessibility)
Please note, if you use the Base64 method, make sure all image data parameters you pass are in Base64 encoding format. When submitting data, do not add any prefixes to the Base64-encoded string, such as data:image/png;base64. The correct parameter format should be the Base64-encoded string itself.
Example: Correct Base64 encoded parameter: 
iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==
Incorrect Base64 encoded parameter (includes the data: prefix): 
data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==
Please provide only the Base64-encoded string portion so that the system can correctly process and parse your data.
● Supported image formats include.jpg / .jpeg / .png
● The image file size cannot exceed 10MB, and the width and height dimensions of the image shall not be less than 300px, and the aspect ratio of the image should be between 1:2.5 ~ 2.5:1
● At least one parameter should be filled in between parameter image and parameter image_tail; cannot both be empty at the same time
Different model versions support different scopes. For details, please refer to the capability map mentioned above.
image_tail	string	Optional	Null	Reference Image - End frame control
● Support inputting image Base64 encoding or image URL (ensure accessibility)
Please note, if you use the Base64 method, make sure all image data parameters you pass are in Base64 encoding format. When submitting data, do not add any prefixes to the Base64-encoded string, such as data:image/png;base64. The correct parameter format should be the Base64-encoded string itself.
Example: Correct Base64 encoded parameter: 
iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==
Incorrect Base64 encoded parameter (includes the data: prefix): 
data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==
Please provide only the Base64-encoded string portion so that the system can correctly process and parse your data.
● Supported image formats include.jpg / .jpeg / .png
● The image file size cannot exceed 10MB, and the width and height dimensions of the image shall not be less than 300px
● At least one parameter should be filled in between parameter image and parameter image_tail; cannot both be empty at the same time
● image_tail, dynamic_masks/static_mask, and camera_control. These three parameters cannot be used at the same time
Different model versions support different scopes. For details, please refer to the capability map mentioned above.
multi_shot	boolean	Optional	false	Whether to generate multi-shot video
● true: the prompt parameter is invalid
● false: the shot_type parameter and the multi_prompt parameter are invalid
shot_type	string	Optional	None	Storyboard method
● Enum values：customize, intelligence
● When the multi_shot parameter is set to true, the current parameter is required
prompt	string	Optional	None	Positive text prompt
● The prompt words can be templated to meet different video generation needs.
The Omni model can achieve various capabilities through Prompt with elements, images, videos, and other content.
1. Specify a element, image, or video in the format of<<<>>, such as<<element_1>>>,<<<image_1>>>,<<<video_1>>>.
2. For more information, please refer to: Kling VIDEO 3.0 Model User Guide
● Cannot exceed 2500 characters.
● Use<<<voice_1>>>to specify the voice, with the same sequence as the voice referenced by the voice_list parameter.
● A video generation task can reference up to 2 tones at most; When specifying a tone, the sound parameter value must be on。
● The simpler the grammar structure, the better. For example: The man <<<voice_1>>> said, "Hello.".
● When the voice_ist parameter is not empty and the prompt parameter references the voice ID, the video generation task will be billed based on the "with voice generation" metric.
● When the multi_shot parameter is false or the shot-type parameter is intelligence, the current parameter must not be empty.
Different model versions support different scopes. For details, please refer to the capability map mentioned above.
multi_prompt	array	Optional	None	Information about each storyboard, such as prompts and duration
● Define the shot sequence number, corresponding prompt word, and duration through the index, prompt, and duration parameters, where:
	○ Supports up to 6 storyboards, with a minimum of 1 storyboard.
	○ The maximum length of the content for each storyboard 512. 
	○ The duration of each storyboard should not exceed the total duration of the current task, and it must not be less than 1.
	○ The sum of the durations of all storyboards equals the total duration of the current task.
● Load with key:value, details as follows:
"multi_prompt":[
	{
  	"index":int,
    "prompt": "string",
    "duration": "5"
  },
  {
  	"index":int,
    "prompt": "string",
    "duration": "5"
  }
]
● When the mult_shot parameter is set to true and the shot_type parameter is set to customize, the current parameter must not be empty.
negative_prompt	string	Optional	Null	Negative text prompt
● Cannot exceed 2500 characters
● It is recommended to supplement negative prompt information through negative sentences directly within positive prompts.
element_list	array	Optional	None	Reference Element List
● Based on element ID configuration. Load with key:value, details as follows:
"element_list":[
	{
   	"element_id":long
  },
  {
   	"element_id":long
  }
]
● Supports up to 3 reference elements.
● The elements are categorized into video customization element (named as Video Character Elements) and image customization elements (named as Multi-Image Elements), each with distinct scopes of application. Please exercise caution in distinguishing between them.
● For more detailed information on the subject, please refer to: Kling Element Library User Guide.
● The element_list parameter and the voice_list parameter are mutually exclusive and cannot coexist.
Different model versions support different scopes. For details, please refer to the capability map mentioned above.
voice_list	array	Optional	None	List of tones referenced when generating videos
● A video generation task can reference up to 2 voices at most.
● When the voice_ist parameter is not empty and the prompt parameter references the voice ID, the video generation task will be billed based on the "with voice generation" metric.
● The value of voice_id parameter is returned through the voice customization interface, or the official voices can be used. For details, please refer to the custom voice API, NOT the voice_id of Lip-Sync API.
● Load with key:value, details as follows:
"voice_list":[
  {"voice_id":"voice_id_1"},
  {"voice_id":"voice_id_2"}
]
● The element_list parameter and the voice_list parameter are mutually exclusive and cannot coexist.
Only V2.6 and subsequent versions of the model supports the current parameters.
sound	string	Optional	off	Is sound generated simultaneously when generating videos
● Enum values: on, off
Only V2.6 and subsequent versions of the model supports the current parameters.
cfg_scale	float	Optional	0.5	Flexibility in video generation; The higher the value, the lower the model's degree of flexibility, and the stronger the relevance to the user's prompt.
● Value range: [0, 1]
Only Kling-v1.x model supports the this parameters.
mode	string	Optional	std	Video generation mode
● Enum values: std, pro
● std: Standard Mode, generating 720P videos, which is cost-effective
● pro: Professional Mode, generating 1080P videos, which is higher quality video output
Different model versions support different scopes. For details, please refer to the capability map mentioned above.
duration	string	Optional	5	Video Length, unit: s (seconds)
● Enum values: 3，4，5，6，7，8，9，10，11，12，13，14，15
Different model versions support different scopes. For details, please refer to the capability map mentioned above.
watermark_info	array	Optional	None	Whether to generate watermarked results simultaneously
● Defined through the ENABLE parameter, the specific array format is as follows:
"watermark_info": {
 	"enabled": boolean // "true" means generate, while "false" means non-generate 
}
● Custom watermark is not supported at this time.
callback_url	string	Optional	None	The callback notification address for the result of this task. If configured, the server will actively notify when the task status changes
● The specific message schema of the notification can be found in "Callback Protocol"
external_task_id	string	Optional	None	Customized Task ID
● Users can provide a customized task ID, which will not overwrite the system-generated task ID but can be used for task queries.
● Please note that the customized task ID must be unique within a single user account.Response Body
{
	"code": 0, //Error codes；Specific definitions can be found in "Error Code"
  "message": "string", //Error information
  "request_id": "string", //Request ID, generated by the system
  "data":{
  	"task_id": "string", //Task ID, generated by the system
    "task_status": "string", //Task status, Enum values：submitted、processing、succeed、failed
    "task_info":{ //Task creation parameters
    	"external_task_id": "string" //Customer-defined task ID
    },
    "created_at": 1722769557708, //Task creation time, Unix timestamp, unit ms
    "updated_at": 1722769557708 //Task update time, Unix timestamp, unit ms
  }
}
Invocation examples
Image-to-video with multi-shot
curl --location 'https://xxx/v1/videos/image2video' \
--header 'Authorization: Bearer xxx' \
--header 'Content-Type: application/json' \
--data '{
    "model_name": "kling-v3",
    "image": "xxx",
    "prompt": "",
    "multi_shot": "true",
    "shot_type": "customize",
    "multi_prompt": [
        {
            "index": 1,
            "prompt": "Two friends talking under a streetlight at night.  Warm glow, casual poses, no dialogue.",
            "duration": "2"
        },
        {
            "index": 2,
            "prompt": "A runner sprinting through a forest, leaves flying.  Low-angle shot, focus on movement.",
            "duration": "3"
        },
        {
            "index": 3,
            "prompt": "A woman hugging a cat, smiling.  Soft sunlight, cozy home setting, emphasize warmth.",
            "duration": "3"
        },
        {
            "index": 4,
            "prompt": "A door creaking open, shadowy hallway.  Dark tones, minimal details, eerie mood.",
            "duration": "3"
        },
        {
            "index": 5,
            "prompt": "A man slipping on a banana peel, shocked expression.  Exaggerated pose, bright colors.",
            "duration": "3"
        },
        {
            "index": 6,
            "prompt": "A sunset over mountains, small figure walking away.  Wide angle, peaceful atmosphere.",
            "duration": "1"
        }
    ],
    "negative_prompt": "",
    "duration": "15",
    "mode": "pro",
    "sound": "on",
    "callback_url": "",
    "external_task_id": ""
}'

Image-to-video with voice of element
curl --location 'https://xxx/v1/videos/image2video' \
--header 'Authorization: Bearer xxx' \
--header 'Content-Type: application/json' \
--data '{
    "model_name": "kling-v3",
    "image": "xxx",
    "image_tail": "xxx",
    "prompt": "The girl with <<<element_1>>> (using <<<voice_1>>>) communicates with the girl with <<<image_1>>> (using <<<voice_2>>>)",
    "element_list": [
        {
            "element_id": long
        }
    ],
    "voice_list": [
        {
            "voice_id": long
        },
        {
            "voice_id": long
        }
    ],
    "negative_prompt": "xxx",
    "duration": "9",
    "mode": "std",
    "sound": "on",
    "callback_url": "xxx",
    "external_task_id": "",
}'

Image to Video - Query Task (Single)Protocol	https
Request URL	/v1/videos/image2video/{id}
Request Method	GET
Request Format	application/json
Response Format	application/jsonRequest HeaderField	Value	Description 
Content-Type	application/json	Data Exchange Format
Authorization	Authentication information, refer to API authentication	Authentication information, refer to API authenticationRequest Path ParametersField	Type	Required Field	DefaultValue	Description 
task_id	string	Optional	None	Task ID for Image to Video
● Request Path Parameters，directly fill the Value in the request path
● When creating a task, you can choose to query by external_task_id or task_id.
external_task_id	string	Optional	None	Customized Task ID for Image-to-Video
● Request Path Parameters，directly fill the Value in the request path
● When creating a task, you can choose to query by external_task_id or task_id.Request Body
None
Response Body
{
	"code": 0, //Error codes；Specific definitions can be found in "Error Code"
  "message": "string", //Error information
  "request_id": "string", //Request ID, generated by thTask ID, generated by the system is used to track requests and troubleshoot problems
  "data":{
  	"task_id": "string", //Task ID, generated by the system
    "task_status": "string", //Task status, Enum values：submitted、processing、succeed、failed
    "task_status_msg": "string", //Task status information, displaying the failure reason when the task fails (such as triggering the content risk control of the platform, etc.)
    "task_info":{ //Task creation parameters
    	"external_task_id": "string" //Customer-defined task ID
    },
    "watermark_info": {
    	"enabled": boolean
    },
    "final_unit_deduction": "string", // The deduction units of task
    "created_at": 1722769557708, //Task creation time, Unix timestamp, unit: ms
    "updated_at": 1722769557708, //Task update time, Unix timestamp, unit: ms
    "task_result":{
      "videos":[
        {
        	"id": "string", //Generated video ID; globally unique
      		"url": "string", //URL for generating videos，such as https://p1.a.kwimgs.com/bs2/upload-ylab-stunt/special-effect/output/HB1_PROD_ai_web_46554461/-2878350957757294165/output.mp4(To ensure information security, generated images/videos will be cleared after 30 days. Please make sure to save them promptly.)
      		"watermark_url": "string", //URL for generating videos with watermark，hotlink protection format
          "duration": "string" //Total video duration, unit: s (seconds)
        }
      ]
    }
  }
}

Image to Video - Query Task (List)Protocol	https
Request URL	/v1/videos/image2video
Request Method	GET
Request Format	application/json
Response Format	application/jsonRequest HeaderField	Value	Description 
Content-Type	application/json	Data Exchange Format
Authorization	Authentication information, refer to API authentication	Authentication information, refer to API authenticationQuery ParametersField	Type	Required Field	DefaultValue	Description 
pageNum	int	Optional	1	Page number
● Value range：[1,1000]
pageSize	int 	Optional	30	Data volume per page
● Value range：[1,500]Request Body
None
Response Body
{
	"code": 0, //Error codes；Specific definitions can be found in Error codes
  "message": "string", //Error information
  "request_id": "string", //Request ID, generated by the system,Task ID, generated by the systemgenerated by the systemto track requests and troubleshoot problems
  "data":[
    {
      "task_id": "string", //Task ID, generated by the system
      "task_status": "string", //Task status, Enum values：submitted、processing、succeed、failed
      "task_status_msg": "string", //Task status information, displaying the failure reason when the task fails (such as triggering the content risk control of the platform, etc.)
      "task_info":{ //Task creation parameters
    		"external_task_id": "string" //Customer-defined task ID
    	},
      "watermark_info": {
        "enabled": boolean
      },
    	"final_unit_deduction": "string", // The deduction units of task
      "created_at": 1722769557708, //Task creation time, Unix timestamp, unit: ms
    	"updated_at": 1722769557708, //Task update time, Unix timestamp, unit: ms
      "task_result":{
        "videos":[
          {
            "id": "string", //Generated video ID; globally unique
            "url": "string", //URL for generating videos，such as https://p1.a.kwimgs.com/bs2/upload-ylab-stunt/special-effect/output/HB1_PROD_ai_web_46554461/-2878350957757294165/output.mp4(To ensure information security, generated images/videos will be cleared after 30 days. Please make sure to save them promptly.)
	      		"watermark_url": "string", //URL for generating videos with watermark，hotlink protection format
            "duration": "string" //Total video duration, unit: s (seconds)
          }
        ]
    	}
    }
  ]
}

Omni-Image - Create TaskProtocol	https
Request URL	/v1/images/omni-image
Request Method	POST
Request Format	application/json
Response Format	application/jsonRequest HeaderField	Value	Description
Content-Type	application/json	Data Exchange Format
Authorization	Authentication information, refer to API authentication	Authentication information, refer to API authenticationRequest BodyField	Type	Required Field	Default	Description
model_name	string	Optional	kling-image-o1	Model Name
● Enum values：kling-image-o1，kling-v3-omni
prompt	string	Required	Null	Text prompt words, which can include positive and negative descriptions.
● The prompt words can be templated to meet different video generation needs.
● Must not exceed 2,500 characters.
The Omni model can achieve various capabilities through Prompt with elements, images, videos, and other content.
1. Specify an image in the format of<<<>>, such as<<<image_1>>>.
2. The scope of abilities can be found in the user manual:KLING Omni Model User Guide.
image_list	array	Optional	None	Reference Image List
● Load with key:value, details as follows:
"image_list":[
	{
  	"image":"image_url",
  },
  {
  	"image":"image_url",
  }
]
● Supports inputting image Base64 encoding or image URL (ensure accessibility).
● Supported image formats include.jpg / .jpeg / .png.
● The image file size cannot exceed 10MB, and the width and height dimensions of the image shall not be less than 300px, and the aspect ratio of the image should be between 1:2.5 ~ 2.5:1.
● The amount of reference element is related to the amount of reference image, the sum of the amount of reference element and the amount of reference image shall not exceed 10.
● The image_url parameter value must not be empty.
element_list	array	Optional	None	Reference Element List
● Based on element ID configuration. Load with key:value, details as follows:
"element_list":[
	{
   	"element_id":long
  },
  {
   	"element_id":long
  }
]
● The amount of reference element is related to the amount of reference image, the sum of the amount of reference element and the amount of reference image shall not exceed 10.
resolution	string	Optional	1k	Image generation resolution
● Enum values：1k, 2k, 4k
	○ 1k：1K standard
	○ 2k：2K high-res
	○ 4k：4K high-res
Different model versions support different scopes. For details, please refer to the capability map mentioned above.
result_type	string	Optional	single	Control whether to generate a single image or a series of image
● Value range：single, series
Different model versions support different scopes. For details, please refer to the capability map mentioned above.
n	int	Optional	1	Number of generated images
● Value range：[1,9]
Different model versions support different scopes. For details, please refer to the capability map mentioned above.
series_amount	int	Optional	4	Control whether to generate a single image or a series of image
● Value range：[2,9]
Different model versions support different scopes. For details, please refer to the capability map mentioned above.
aspect_ratio	string	Optional	auto	Aspect ratio of the generated images (width:height)
● Enum values: 16:9, 9:16, 1:1, 4:3, 3:4, 3:2, 2:3, 21:9, auto:
	○ auto  is to intelligently generate videos based on incoming content.
● When generating a new image based on the horizontal to vertical ratio of the original image, the current parameter is invalid.
Different model versions support different scopes. For details, please refer to the capability map mentioned above.
callback_url	string	Optional	None	The callback notification address for the result of this task. If configured, the server will actively notify when the task status changes
● The specific message schema of the notification can be found in "Callback Protocol"
external_task_id	string	Optional	None	Customized Task ID
● Users can provide a customized task ID, which will not overwrite the system-generated task ID but can be used for task queries.
● Please note that the customized task ID must be unique within a single user account.Response Body
{
	"code": 0, //Error Codes；Specific definitions can be found in Error codes
  "message": "string", //Error information
  "request_id": "string", //Request ID, generated by the system, is used to track requests and troubleshoot problems
  "data":{
  	"task_id": "string", //Task ID, generated by the system
    "task_info":{ //Task creation parameters
    	"external_task_id": "string" //Customer-defined task ID
    }, 
    "task_status": "string", //Task status, Enum values：submitted、processing、succeed、failed
    "created_at": 1722769557708, //Task creation time, Unix timestamp, unit ms
    "updated_at": 1722769557708 //Task update time, Unix timestamp, unit ms
  }
}
Invocation examples
Image generation with element
curl --location 'https://xxx/v1/images/generations' \
--header 'Authorization: Bearer xxx' \
--header 'Content-Type: application/json' \
--data '{
    "model_name": "kling-v3-omni",
    "prompt": "Generate a recommended cover for each subject <<object_1>> based on the style of the reference image <<image_1>>",
    "element_list": [
      {
        "element_id": "160"
      },
      {
        "element_id": "161"
      }
    ],
    "image_list": [
      {
        "image": "xxx"
      },
      {
        "image": "xxx"
      }
    ],
    "resolution": "2k",
    "result_type": "series",
    "series_amount": 2,
    "aspect_ratio": "auto",
    "external_task_id": "",
    "callback_url": ""
  }'

Omni-Image - Query Task (Single)Protocol	https
Request URL	/v1/images/omni-image/{id}
Request Method	GET
Request Format	application/json
Response Format	application/jsonRequest HeaderField	Value	Description 
Content-Type	application/json	Data Exchange Format
Authorization	Authentication information, refer to API authentication	Authentication information, refer to API authenticationRequest Path ParametersField	Type	Required Field	DefaultValue	Description 
task_id	string	Optional	None	Task ID
● Request Path Parameters，directly fill the Value in the request path
● When creating a task, you can choose to query by external_task_id or task_id.
external_task_id	string	Optional	None	Customized Task ID
● Request Path Parameters，directly fill the Value in the request path
● When creating a task, you can choose to query by external_task_id or task_id.Request Body
None
Response Body
{
	"code": 0, //Error codes；Specific definitions can be found in Error codes
  "message": "string", // Error information
  "request_id": "string", // Request ID, generated by the system, is used to track requests and troubleshoot problems
  "data":{
    "task_id": "string", // Task ID, generated by the system
    "task_status": "string", // Task status, Enum values：submitted、processing、succeed、failed
    "task_status_msg": "string", // Task status information, displaying the failure reason when the task fails (such as triggering the content risk control of the platform, etc.)
		"task_info":{ // Task creation parameters
  		"external_task_id": "string" //Customer-defined task ID
  	}, 
    "final_unit_deduction": "string", // The deduction units of task
    "created_at": 1722769557708, // Task creation time, Unix timestamp, unit ms
    "updated_at": 1722769557708, // Task update time, Unix timestamp, unit ms
    "task_result":{
      "result_type": "single",
      "images":[
        {
          "index": int, // Image Number，0-9
          "url": "string" // URL for generating images，hotlink protection format(To ensure information security, generated images/videos will be cleared after 30 days. Please make sure to save them promptly.)
        }
    	],
      "series_images":[
        {
        	"index": int, // Series-image sequence number
          "url": "string" // URL for generating images，hotlink protection format(To ensure information security, generated images/videos will be cleared after 30 days. Please make sure to save them promptly.)
        }
      ]
    }
  }
}

Omni-Image - Query Task (List)Protocol	https
Request URL	/v1/images/omni-image
Request Method	GET
Request Format	application/json
Response Format	application/jsonRequest HeaderField	Value	Description 
Content-Type	application/json	Data Exchange Format
Authorization	Authentication information, refer to API authentication	Authentication information, refer to API authenticationQuery ParametersField	Type	Required Field	Default Value	Description 
pageNum	int	Optional	1	Page number
● Value range：[1,1000]
pageSize	int 	Optional	30	Data volume per page
● Value range：[1,500]Request Body
None
Response Body
{
	"code": 0, //Error codes；Specific definitions can be found in Error codes
  "message": "string", // Error information
  "request_id": "string", // Request ID, generated by the system, is used to track requests and troubleshoot problems
  "data":[
    {
      "task_id": "string", // Task ID, generated by the system
      "task_status": "string", // Task status, Enum values：submitted、processing、succeed、failed
      "task_status_msg": "string", // Task status information, displaying the failure reason when the task fails (such as triggering the content risk control of the platform, etc.)
      "task_info":{ // Task creation parameters
        "external_task_id": "string" //Customer-defined task ID
      }, 
      "final_unit_deduction": "string", // The deduction units of task
      "created_at": 1722769557708, // Task creation time, Unix timestamp, unit ms
      "updated_at": 1722769557708, // Task update time, Unix timestamp, unit ms
      "task_result":{
        "result_type": "single",
        "images":[
          {
            "index": int, // Image Number，0-9
            "url": "string" // URL for generating images，hotlink protection format(To ensure information security, generated images/videos will be cleared after 30 days. Please make sure to save them promptly.)
          }
        ],
        "series_images":[
          {
            "index": int, // Series-image sequence number
            "url": "string" // URL for generating images，hotlink protection format(To ensure information security, generated images/videos will be cleared after 30 days. Please make sure to save them promptly.)
          }
        ]
      }
    }
  ]
}

Image Generation - Create taskProtocol	https
Request URL	/v1/images/generations
Request Method	POST
Request Format	application/json
Response Format	application/jsonRequest HeaderField	Value	Description
Content-Type	application/json	Data Exchange Format
Authorization	Authentication information, refer to API authentication	Authentication information, refer to API authenticationRequest BodyField	Type	Required Field	Default	Description
model_name	string	Optional	kling-v1	Model Name
● Enum values：kling-v1, kling-v1-5, kling-v2, kling-v2-new, kling-v2-1, kling-v3
prompt	string	Required	Null	Text prompt words, which can include positive and negative descriptions.
● The prompt words can be templated to meet different video generation needs.
● Must not exceed 2,500 characters.
negative_prompt	string	Optional	None	Negative text prompt
● Cannot exceed 2500 characters
● It is recommended to supplement negative prompt information through negative sentences directly within positive prompts.
Note: In the Image-to-Image scenario (when the "image" field is not empty), negative prompts are not supported.
image	string	Optional	None	Reference Image
● Support inputting image Base64 encoding or image URL (ensure accessibility)
Please note, if you use the Base64 method, make sure all image data parameters you pass are in Base64 encoding format. When submitting data, do not add any prefixes to the Base64-encoded string, such as data:image/png;base64. The correct parameter format should be the Base64-encoded string itself.
Example: Correct Base64 encoded parameter: 
iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==
Incorrect Base64 encoded parameter (includes the data: prefix): 
data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==
Please provide only the Base64-encoded string portion so that the system can correctly process and parse your data.
● Supported image formats include.jpg / .jpeg / .png
● The image file size cannot exceed 10MB, and the width and height dimensions of the image shall not be less than 300px, and the aspect ratio of the image should be between 1:2.5 ~ 2.5:1
● the image_reference parameter is not empty, the current parameter is required
element_list	array	Optional	None	Reference Element List
● Based on element ID configuration. Load with key:value, details as follows:
"element_list":[
	{
   	"element_id":long
  }
]
● The amount of reference element is related to the amount of reference image, the sum of the amount of reference element and the amount of reference image shall not exceed 10.
resolution	string	Optional	1k	Image generation resolution
● Enum values：1k, 2k
	○ 1k：1K standard
	○ 2k：2K high-res
Different model versions support different scopes. For details, please refer to the capability map mentioned above.
n	int	Optional	1	Number of generated images
● Value range：[1,9]
aspect_ratio	string	Optional	16:9	Aspect ratio of the generated images (width:height)
● Enum values：16:9, 9:16, 1:1, 4:3, 3:4, 3:2, 2:3, 21:9
Different model versions support different scopes. For details, please refer to the capability map mentioned above.
callback_url	string	Optional	Null	The callback notification address for the result of this task. If configured, the server will actively notify when the task status changes
● The specific message schema of the notification can be found in "Callback Protocol".
external_task_id	string	Optional	Null	Customized Task ID for Video Effects
● Request Path Parameters，directly fill the Value in the request path.
● When creating a task, you can choose to query by external_task_id or task_id.Response Body
{
	"code": 0, //Error Codes；Specific definitions can be found in Error codes
  "message": "string", //Error information
  "request_id": "string", //Request ID, generated by the system, is used to track requests and troubleshoot problems
  "data":{
  	"task_id": "string", //Task ID, generated by the system
    "task_status": "string", //Task status, Enum values：submitted、processing、succeed、failed
    "task_info":{ //Task creation parameters
  	"external_task_id": "string" //Customer-defined task ID
  	},
    "created_at": 1722769557708, //Task creation time, Unix timestamp, unit ms
    "updated_at": 1722769557708 //Task update time, Unix timestamp, unit ms
  }
}
Invocation examples
Image generation with element
curl --location 'https://api-singapore.klingai.com/v1/images/generations' \
--header 'Authorization: Bearer xxx' \
--header 'Content-Type: application/json' \
--data '{
    "model_name": "kling-v3",
    "prompt": "Merge all the characters from the images into the <<<object_2>>> diagram",
    "element_list": [
        {
            "element_id": "160"
        },
        {
            "element_id": "161"
        },
        {
            "element_id": "159"
        }
    ],
    "image": "xxx",
    "resolution": "2k",
    "n": "9",
    "aspect_ratio": "3:2",
    "external_task_id": "",
    "callback_url": ""
}'

Image Generation - Query Task (Single)Protocol	https
Request URL	/v1/images/generations/{id}
Request Method	GET
Request Format	application/json
Response Format	application/jsonRequest HeaderField	Value	Description 
Content-Type	application/json	Data Exchange Format
Authorization	Authentication information, refer to API authentication	Authentication information, refer to API authenticationRequest Path ParametersField	Type	Required Field	DefaultValue	Description 
task_id	string	Required	None	The task ID generated by images
● Request Path Parameters，directly fill the Value in the request path
external_task_id	string	Optional	None	Customized Task ID
● Request Path Parameters，directly fill the Value in the request path
● When creating a task, you can choose to query by external_task_id or task_id.Request Body
None
Response Body
{
	"code": 0, //Error codes；Specific definitions can be found in Error codes
  "message": "string", //Error information
  "request_id": "string", //Request ID, generated by the system, is used to track requests and troubleshoot problems
  "data":{
  	"task_id": "string", //Task ID, generated by the system
    "task_status": "string", //Task status, Enum values：submitted、processing、succeed、failed
    "task_status_msg": "string", //Task status information, displaying the failure reason when the task fails (such as triggering the content risk control of the platform, etc.)
    "final_unit_deduction": "string", // The deduction units of task
    "created_at": 1722769557708, //Task creation time, Unix timestamp, unit ms
    "updated_at": 1722769557708, //Task update time, Unix timestamp, unit ms
    "task_result":{
    	"images":[
        {
        	"index": int, //Image Number，0-9
          "url": "string" //URL for generating images，such as：https://h1.inkwai.com/bs2/upload-ylab-stunt/1fa0ac67d8ce6cd55b50d68b967b3a59.png(To ensure information security, generated images/videos will be cleared after 30 days. Please make sure to save them promptly.)
        }
      ]
    },
    "task_info":{ //Task creation parameters
  	"external_task_id": "string" //Customer-defined task ID
  	}
  }
}

Image Generation - Query Task (List)Protocol	https
Request URL	/v1/images/generations
Request Method	GET
Request Format	application/json
Response Format	application/jsonRequest HeaderField	Value	Description 
Content-Type	application/json	Data Exchange Format
Authorization	Authentication information, refer to API authentication	Authentication information, refer to API authenticationQuery ParametersField	Type	Required Field	Default Value	Description 
pageNum	int	Optional	1	Page number
● Value range：[1,1000]
pageSize	int 	Optional	30	Data volume per page
● Value range：[1,500]Request Body
None
Response Body
{
	"code": 0, //Error codes；Specific definitions can be found in Error codes
  "message": "string", //Error information
  "request_id": "string", //Request ID, generated by the system, is used to track requests and troubleshoot problems
  "data":[
      {
      "task_id": "string", //Task ID, generated by the system
      "task_status": "string", //Task status, Enum values：submitted、processing、succeed、failed
      "task_status_msg": "string", //Task status information, displaying the failure reason when the task fails (such as triggering the content risk control of the platform, etc.)
      "final_unit_deduction": "string", // The deduction units of task
      "created_at": 1722769557708, //Task creation time, Unix timestamp, unit ms
      "updated_at": 1722769557708, //Task update time, Unix timestamp, unit ms
      "task_result":{
        "images":[
          {
            "index": int, //Image Number，0-9
            "url": "string" //URL for generating images，such as：https://h1.inkwai.com/bs2/upload-ylab-stunt/1fa0ac67d8ce6cd55b50d68b967b3a59.png(To ensure information security, generated images/videos will be cleared after 30 days. Please make sure to save them promptly.)
          }
        ]
      },
      "task_info":{ //Task creation parameters
      "external_task_id": "string" //Customer-defined task ID
      }
    }
  ]
}

General - Create Element
The service related to creating entities has been upgraded to a brand new version. If you need to browse the old version, please proceed to: Kling AI (OLD VERSION) ELEMENTS API SpecificationProtocol	https
Request URL	/v1/general/advanced-custom-elements
Request Method	POST
Request Format	application/json
Response Format	application/jsonRequest HeaderField	Value	Description 
Content-Type	application/json	Data Exchange Format
Authorization	Authentication information, refer to API authentication	Authentication information, refer to API authenticationRequest BodyField	Type	Required Field	Default Value	Description 
element_name	string	Required	Null	Element Name
● Must not exceed 20 characters.
element_description	string	Required	Null	Element Description
● Must not exceed 100 characters.
reference_type	string	Required	Null	Reference Method
● Enum values：video_refer, image_refer
	○ video_refer: Video Character Elements, at this time, the subject's appearance will be defined with reference to element_video_list.
	○ image_refer: Multi-Image Elements, whose appearance will be defined with reference to the element_image_list.
● The scope of availability differs between entities customized through videos and those customized through images. Please refer to the capability map and parameter specifications for details.
element_image_list	array	Optional	None	The main reference image allows for the setting of the element and its details through multiple images.
● Include front reference images and reference images from other angles or close-ups, where:
	○ At least include one frontal reference image, defined by the frontal_image parameter
	○ It is required to include 1 to 3 additional reference images, which should differ from the front reference image and are defined by the image_url parameter
● Load with key:value, details as follows:
"element_image_list":{
  "frontal_image":"image_url_0",
  "refer_images":[
    {
      "image_url":"image_url_1"
    },
    {
      "image_url":"image_url_2"
    },
    {
      "image_url":"image_url_3"
    }
  ]
}
● Supports inputting image Base64 encoding or image URL (ensure accessibility).
● Supported image formats include.jpg / .jpeg / .png.
● The image file size cannot exceed 10MB, and the width and height dimensions of the image shall not be less than 300px, and the aspect ratio of the image should be between 1:2.5 ~ 2.5:1.
● When the value of the reference_type parameter is image_refer, the current parameter is required.
element_video_list	array	Optional	None	The element is referenced by the video, and its details can be set through the video
● ● Audio videos can be uploaded. If the audio video contains human voice, it will trigger voice customization (customization + inclusion in voice library + binding with the element).
● Current parameters are required when referencing videos, but are invalid when referencing images.
● Load with key:value, details as follows:
"element_video_list":{
  "refer_videos":[
    {
      "video_url":"video_url_1"
    }
  ]
}
● Only .mp4/.mov formats are supported.
● Only supports 1080P videos with a duration between 3s and 8s, and an aspect ratio of 16:9 or 9:16.
● Only supports 1 video can be uploaded, with a video size not exceeding 200MB.
● The value of video_url parameter must not be empty.
● The entity for video customization is only supported for models kling-video-o3 and later.
element_voice_id	string	Optional	None	The tone of element can be bound to existing tone colors in the tone library
● When the current parameter is empty, the current entity is not bound to a tone color.
● The ID can be obtained through the voice-related API. For details, see: Kling AI NEW API Specification.
● Only the elements customized for video support binding with voice.
tag_list	array	Optional	None	Configure tags for the subject, one subject can configure multiple tags.
● Load with key:value, details as follows:
"tag_list": [
  {
		"tag_id": "o_101"
	}, {
		"tag_id": "o_102"
	}
]
● The relationship between tag ID and name：ID	Name
o_101	Hottest
o_102	Character
o_103	Animal
o_104	Item
o_105	Costume
o_106	Scene
o_107	Effect
o_108	Others

external_task_id	string	Optional	None	Customized Task ID
● Users can provide a customized task ID, which will not overwrite the system-generated task ID but can be used for task queries.
● Please note that the customized task ID must be unique within a single user account.
callback_url	string	Optional	None	The callback notification address for the result of this task. If configured, the server will actively notify when the task status changes
● The specific message schema of the notification can be found in "Callback Protocol"Response Body
{
	"code": 0, //Error codes；Specific definitions can be found in "Error Code"
  "message": "string", //Error information
  "request_id": "string", //Request ID, generated by the system
  "data":{
  	"task_id": "string", //Task ID, generated by the system
    "task_status": "string", //Task status, Enum values：submitted、processing、succeed、failed
    "task_info":{ //Task creation parameters
    	"external_task_id": "string" //Customer-defined task ID
    },
    "created_at": 1722769557708, //Task creation time, Unix timestamp, unit ms
    "updated_at": 1722769557708 //Task update time, Unix timestamp, unit ms
  }
}
Invocation examples
Create Multi-Image Elements
curl --location 'https://xxx/v1/general/advanced-custom-elements/' \
--header 'Authorization: Bearer xxx' \
--header 'Content-Type: application/json\' \
--data '{
    "element_name": "xxx",
    "element_description": "xxx",
    "reference_type": "image_refer",
    "element_image_list": {
      "frontal_image": "xxx",
      "refer_images": [
        {"image_url": "xxx"},
        {"image_url": "xxx"}
      ]
    },
    "element_voice_id": long,
    "callback_url": "xxx",
    "external_task_id": "",
     "tag_list": [
        {
            "tag_id": "xxx"
        }
    ]
  }'
Create Video Character Elements
curl --location 'https://xxx/v1/general/advanced-custom-elements/' \
--header 'Authorization: Bearer xxx' \
--header 'Content-Type: application/json\' \
--data '{
    "element_name": "xxx",
    "element_description": "xxx",
    "reference_type": "video_refer",
    "element_video_list": {
        "refer_videos": [
            {
                "video_url": "xxx"
            }
        ]
    },
    "element_voice_id": long,
    "callback_url": "xxx",
    "external_task_id": "",
    "tag_list": [
        {
            "tag_id": "xxx"
        }
    ]
}'

General - Query Custom Element (Single)
The service related to creating entities has been upgraded to a brand new version. If you need to browse the old version, please proceed to: Kling AI (OLD VERSION) ELEMENTS API SpecificationProtocol	https
Request URL	/v1/general/advanced-custom-elements/{id}
Request Method	GET
Request Format	application/json
Response Format	application/jsonRequest HeaderField	Value	Description 
Content-Type	application/json	Data Exchange Format
Authorization	Authentication information, refer to API authentication	Authentication information, refer to API authenticationRequest Path ParametersField	Type	Required Field	DefaultValue	Description 
task_id	string	Required	None	The task ID generated by images
● Request Path Parameters，directly fill the Value in the request path
external_task_id	string	Optional	None	Customized Task ID
● Request Path Parameters，directly fill the Value in the request path
● When creating a task, you can choose to query by external_task_id or task_id.Request Body
None
Response Body
{
	"code": 0, //Error codes；Specific definitions can be found in "Error Code"
  "message": "string", //Error information
  "request_id": "string", //Request ID, generated by thTask ID, generated by the system is used to track requests and troubleshoot problems
  "data":{
  	"task_id": "string", //Task ID, generated by the system
    "task_status": "string", //Task status, Enum values：submitted、processing、succeed、failed
    "task_status_msg": "string", //Task status information, displaying the failure reason when the task fails (such as triggering the content risk control of the platform, etc.)
    "task_info":{ //Task creation parameters
    	"external_task_id": "string" //Customer-defined task ID
    },
    "task_result":{
      "elements":[
        {
          "element_id": long,
    			"element_name": "string",
    			"element_description": "string",
					"reference_type": "video_refer",
          "element_image_list":{
            "frontal_image":"image_url_0",
     				"refer_images":[
              {
                "image_url":"image_url_1"
              },
              {
                "image_url":"image_url_2"
              },
              {
                "image_url":"image_url_3"
              }
            ]
    			},
          "element_video_list":{
            "refer_videos":[
              {
                "video_url":"video_url_1"
              }
            ]
          },
          "element_voice_info":{
            "voice_id": "string", //Generated voice ID; globally unique
            "voice_name": "string", //Generated voice name
            "trial_url": "string", // URL for generating videos
            "owned_by": "kling" // Voice source, kling is the official voice library, and others are the creator's ID
          },    
          "tag_list":[
            {
              "id": "o_101",
              "name": "animal",
              "description": "The content of description."
            },
            {
              "id": "o_102",
              "name": "animal",
              "description": "The content of description."
            }
          ],
      		"owned_by": "kling" // Element source, kling is the official element library, and others are the creator's ID
        }
      ]
    },
   	"final_unit_deduction": "string", // The deduction units of task
    "created_at": 1722769557708, //Task creation time, Unix timestamp, unit: ms
    "updated_at": 1722769557708 //Task update time, Unix timestamp, unit: ms
  }
}
Invocation examples
Query a specific custom entity
curl --location 'https://xxx/v1/general/advanced-custom-elements/xxx' \
--header 'Authorization: Bearer xxx' \
--header 'Content-Type: application/json\' \
--data ''

General - Query Custom Element (List)
The service related to creating entities has been upgraded to a brand new version. If you need to browse the old version, please proceed to: Kling AI (OLD VERSION) ELEMENTS API SpecificationProtocol	https
Request URL	/v1/general/advanced-custom-elements
Request Method	GET
Request Format	application/json
Response Format	application/jsonRequest HeaderField	Value	Description 
Content-Type	application/json	Data Exchange Format
Authorization	Authentication information, refer to API authentication	Authentication information, refer to API authenticationRequest Body
None
Query ParametersField	Type	Required Field	Default Value	Description 
pageNum	int	Optional	1	Page number
● Value range：[1,1000]
pageSize	int 	Optional	30	Data volume per page
● Value range：[1,500]Response Body
{
	"code": 0, //Error codes；Specific definitions can be found in "Error Code"
  "message": "string", //Error information
  "request_id": "string", //Request ID, generated by thTask ID, generated by the system is used to track requests and troubleshoot problems
  "data":[
    {
        "task_id": "string", //Task ID, generated by the system
        "task_status": "string", //Task status, Enum values：submitted、processing、succeed、failed
        "task_status_msg": "string", //Task status information, displaying the failure reason when the task fails (such as triggering the content risk control of the platform, etc.)
        "task_info":{ //Task creation parameters
          "external_task_id": "string" //Customer-defined task ID
        },
        "task_result":{
          "elements":[
            {
              "element_id": long,
              "element_name": "string",
              "element_description": "string",
              "reference_type": "video_refer",
              "element_image_list":{
                "frontal_image":"image_url_0",
                "refer_images":[
                  {
                    "image_url":"image_url_1"
                  },
                  {
                    "image_url":"image_url_2"
                  },
                  {
                    "image_url":"image_url_3"
                  }
                ]
              },
              "element_video_list":{
                "refer_videos":[
                  {
                    "video_url":"video_url_1"
                  }
                ]
              },
              "element_voice_info":{
                "voice_id": "string", //Generated voice ID; globally unique
                "voice_name": "string", //Generated voice name
                "trial_url": "string", // URL for generating videos
                "owned_by": "kling" // Voice source, kling is the official voice library, and others are the creator's ID
              },    
              "tag_list":[
                {
                  "id": "o_101",
                  "name": "animal",
                  "description": "The content of description."
                },
                {
                  "id": "o_102",
                  "name": "animal",
                  "description": "The content of description."
                }
              ],
              "owned_by": "kling" // Element source, kling is the official element library, and others are the creator's ID
            }
          ]
        },
        "final_unit_deduction": "string", // The deduction units of task
        "created_at": 1722769557708, //Task creation time, Unix timestamp, unit: ms
        "updated_at": 1722769557708 //Task update time, Unix timestamp, unit: ms
      }
  ]
}
Invocation examples
List query of custom elements
curl --location 'https:/xxx/v1/general/advanced-custom-elements?pageNum=1&pageSize=30' \
--header 'Authorization: Bearer xxx' \
--header 'Content-Type: application/json\' \
--data ''
General - Query Presets Element (List)
The service related to creating entities has been upgraded to a brand new version. If you need to browse the old version, please proceed to: Kling AI (OLD VERSION) ELEMENTS API SpecificationProtocol	https
Request URL	/v1/general/advanced-presets-elements
Request Method	GET
Request Format	application/json
Response Format	application/jsonRequest HeaderField	Value	Description 
Content-Type	application/json	Data Exchange Format
Authorization	Authentication information, refer to API authentication	Authentication information, refer to API authenticationQuery ParametersField	Type	Required Field	Default Value	Description 
pageNum	int	Optional	1	Page number
● Value range：[1,1000]
pageSize	int 	Optional	30	Data volume per page
● Value range：[1,500]Request Body
None
Response Body
{
	"code": 0, //Error codes；Specific definitions can be found in "Error Code"
  "message": "string", //Error information
  "request_id": "string", //Request ID, generated by thTask ID, generated by the system is used to track requests and troubleshoot problems
  "data":[
    {
        "task_id": "string", //Task ID, generated by the system
        "task_status": "string", //Task status, Enum values：submitted、processing、succeed、failed
        "task_status_msg": "string", //Task status information, displaying the failure reason when the task fails (such as triggering the content risk control of the platform, etc.)
        "task_info":{ //Task creation parameters
          "external_task_id": "string" //Customer-defined task ID
        },
        "task_result":{
          "elements":[
            {
              "element_id": long,
              "element_name": "string",
              "element_description": "string",
              "reference_type": "video_refer",
              "element_image_list":{
                "frontal_image":"image_url_0",
                "refer_images":[
                  {
                    "image_url":"image_url_1"
                  },
                  {
                    "image_url":"image_url_2"
                  },
                  {
                    "image_url":"image_url_3"
                  }
                ]
              },
              "element_video_list":{
                "refer_videos":[
                  {
                    "video_url":"video_url_1"
                  }
                ]
              },
              "element_voice_info":{
                "voice_id": "string", //Generated voice ID; globally unique
                "voice_name": "string", //Generated voice name
                "trial_url": "string", // URL for generating videos
                "owned_by": "kling" // Voice source, kling is the official voice library, and others are the creator's ID
              },    
              "tag_list":[
                {
                  "id": "o_101",
                  "name": "animal",
                  "description": "The content of description."
                },
                {
                  "id": "o_102",
                  "name": "animal",
                  "description": "The content of description."
                }
              ],
              "owned_by": "kling" // Element source, kling is the official element library, and others are the creator's ID
            }
          ]
        },
        "final_unit_deduction": "string", // The deduction units of task
        "created_at": 1722769557708, //Task creation time, Unix timestamp, unit: ms
        "updated_at": 1722769557708 //Task update time, Unix timestamp, unit: ms
      }
  ]
}

General - Delete Custom ElementProtocol	https
Request URL	/v1/general/delete-elements
Request Method	POST
Request Format	application/json
Response Format	application/jsonRequest HeaderField	Value	Description 
Content-Type	application/json	Data Exchange Format
Authorization	Authentication information, refer to API authentication	Authentication information, refer to API authenticationRequest BodyField	Type	Required Field	Default	Description
element_id	string	Required	Null	The ID of the element to be deleted only supports deleting custom elements.Response Body
{
	"code": 0, //Error codes；Specific definitions can be found in "Error Code"
  "message": "string", //Error information
  "request_id": "string", //Request ID, generated by the system
  "data":{
  	"task_id": "string", //Task ID, generated by the system
    "task_status": "string", //Task status, Enum values：submitted、processing、succeed、failed
  }
}

Prepaid Resource PacksCredit Deduction Details	
	

Single Video Specification	Resource Package Deduction Count	Pricing (Original)
【Kling Video-3O】Standard mode, 1-second video duration, without video input, without native audio generation	Deduct 0.6 units from total	$0.084
【Kling Video-3O】Standard mode, 1-second video duration, without video input, with native audio generation	Deduct 0.8 units from total	$0.112
【Kling Video-3O】Standard mode, 1-second video duration, with video input, without native audio generation	Deduct 0.9 units from total	$0.126
【Kling Video-3O】Standard mode, 1-second video duration, with video input, with native audio generation	Deduct 1.1 units from total	$0.154
【Kling Video-3O】Professional mode, 1-second video duration, without video input, without native audio generation	Deduct 0.8 units from total	$0.112
【Kling Video-3O】Professional mode, 1-second video duration, without video input, with native audio generation	Deduct 1.0 units from total	$0.14
【Kling Video-3O】Professional mode, 1-second video duration, with video input, without native audio generation	Deduct 1.2 units from total	$0.168
【Kling Video-3O】Professional mode, 1-second video duration, with video input, with native audio generation	Deduct 1.4 units from total	$0.196
【Kling V3.0】Standard mode, 1-second video duration, without native audio generation	Deduct 0.6 units from total	$0.084
【Kling V3.0】Standard mode, 1-second video duration, with native audio generation, without voice control	Deduct 0.9 units from total	$0.126
【Kling V3.0】Standard mode, 1-second video duration, with native audio generation, with voice control	Deduct 1.1 units from total	$0.154
【Kling V3.0】Professional mode, 1-second video duration, without native audio generation	Deduct 0.8 units from total	$0.112
【Kling V3.0】Professional mode, 1-second video duration, with native audio generation, without voice control	Deduct 1.2 units from total	$0.168
【Kling V3.0】Professional mode, 1-second video duration, with native audio generation, with voice control	Deduct 1.4 units from total	$0.196
【Kling V3.0】Motion Control, Standard mode, 1-second video duration	Deduct 0.9 units from total	$0.126
【Kling V3.0】Motion Control, Professional mode, 1-second video duration	Deduct 1.2 units from total	$0.168
【Kolors Image-3O】1K/2K	Deduct 8 unit from total	$0.028
【Kolors Image-3O】4K	Deduct 16 unit from total	$0.056
【Kolors V3.0】1K/2K	Deduct 8 unit from total	$0.028

