import { getDb } from '@/lib/db';
import { JOB_REQUIREMENTS_FIELDS } from '@/lib/shared-schema-modules';
import type { FieldDefinition } from '@/lib/types';

// ============================================================
// SHARED FIELD DEFINITIONS
// ============================================================

const BASE_FIELDS: FieldDefinition[] = [
  {
    key: 'title',
    label: 'Project Title',
    type: 'text',
    required: true,
    placeholder: 'e.g., Q2 Audio Annotation - Voice Assistants',
    description: 'A descriptive title for this intake request',
    validation: { min_length: 3, max_length: 200 },
    width: 'full',
  },
  {
    key: 'urgency',
    label: 'Urgency',
    type: 'button_group',
    required: true,
    default_value: 'standard',
    options: [
      { value: 'urgent', label: 'Urgent', description: 'Needed within 48 hours', icon: 'Zap' },
      { value: 'standard', label: 'Standard', description: '1-2 week turnaround', icon: 'Clock' },
      { value: 'pipeline', label: 'Pipeline', description: 'Ongoing / recurring', icon: 'Repeat' },
    ],
    width: 'full',
  },
  {
    key: 'target_languages',
    label: 'Target Languages',
    type: 'multi_select',
    required: true,
    placeholder: 'Select languages...',
    options_source: 'languages_registry',
    description: 'Languages required for this task',
    width: 'half',
  },
  {
    key: 'target_regions',
    label: 'Target Regions',
    type: 'multi_select',
    required: true,
    placeholder: 'Select regions...',
    options_source: 'regions_registry',
    description: 'Geographic regions for sourcing contributors',
    width: 'half',
  },
  {
    key: 'volume_needed',
    label: 'Volume Needed',
    type: 'number',
    required: true,
    placeholder: 'e.g., 10000',
    description: 'Total number of tasks/items to be completed',
    validation: { min: 1, max: 10000000 },
    width: 'half',
  },
  {
    key: 'compensation_model',
    label: 'Compensation Model',
    type: 'select',
    required: true,
    options: [
      { value: 'per_task', label: 'Per Task' },
      { value: 'per_hour', label: 'Per Hour' },
      { value: 'per_unit', label: 'Per Unit (e.g., per minute of audio)' },
      { value: 'fixed_project', label: 'Fixed Project Rate' },
      { value: 'tbd', label: 'To Be Determined' },
    ],
    width: 'half',
  },
];

const COMMON_FIELDS: FieldDefinition[] = [
  {
    key: 'commitment_level',
    label: 'Commitment Level',
    type: 'button_group',
    required: true,
    default_value: 'flexible',
    options: [
      { value: 'flexible', label: 'Flexible', description: 'Work when available' },
      { value: 'part_time', label: 'Part Time', description: '10-20 hours/week' },
      { value: 'full_time', label: 'Full Time', description: '30-40 hours/week' },
    ],
    width: 'full',
  },
  {
    key: 'training_required',
    label: 'Training Required',
    type: 'toggle_with_text',
    toggle_label: 'This project requires contributor training',
    text_placeholder: 'Describe the training requirements, estimated duration, and any certification needed...',
    width: 'full',
  },
  {
    key: 'nda_required',
    label: 'NDA Required',
    type: 'toggle',
    toggle_label: 'Contributors must sign a Non-Disclosure Agreement',
    width: 'half',
  },
  {
    key: 'special_notes',
    label: 'Special Notes',
    type: 'textarea',
    placeholder: 'Any additional context, requirements, or instructions for the operations team...',
    validation: { max_length: 5000 },
    width: 'full',
  },
];

// ============================================================
// TASK TYPE SCHEMAS
// ============================================================

interface TaskTypeSchemaDefinition {
  task_type: string;
  display_name: string;
  icon: string;
  description: string;
  sort_order: number;
  task_fields: FieldDefinition[];
  conditional_fields: FieldDefinition[];
}

const TASK_TYPE_SCHEMAS: TaskTypeSchemaDefinition[] = [
  // 1. Audio Annotation
  {
    task_type: 'audio_annotation',
    display_name: 'Audio Annotation',
    icon: 'Headphones',
    description: 'Label, segment, and annotate audio files including speech, music, and environmental sounds.',
    sort_order: 1,
    task_fields: [
      {
        key: 'audio_type',
        label: 'Audio Type',
        type: 'select',
        required: true,
        options: [
          { value: 'voice_assistant', label: 'Voice Assistant Recordings' },
          { value: 'call_center', label: 'Call Center Audio' },
          { value: 'podcast', label: 'Podcast / Long-form Audio' },
          { value: 'short_clips', label: 'Short Audio Clips' },
        ],
        width: 'half',
      },
      {
        key: 'annotation_tasks',
        label: 'Annotation Tasks',
        type: 'checkbox_group',
        required: true,
        description: 'Select all annotation tasks required for this project',
        options: [
          { value: 'segmentation', label: 'Audio Segmentation', description: 'Split audio into meaningful segments' },
          { value: 'speaker_labeling', label: 'Speaker Labeling', description: 'Identify and label different speakers' },
          { value: 'transcription', label: 'Transcription', description: 'Convert speech to text' },
          { value: 'intent_labeling', label: 'Intent Labeling', description: 'Classify the intent of speech segments' },
          { value: 'quality_rating', label: 'Quality Rating', description: 'Rate audio quality on a defined scale' },
          { value: 'emotion_tagging', label: 'Emotion Tagging', description: 'Tag emotional tone of speakers' },
        ],
        width: 'full',
      },
      {
        key: 'avg_audio_length',
        label: 'Average Audio Length',
        type: 'select',
        required: true,
        options: [
          { value: 'under_1min', label: 'Under 1 minute' },
          { value: '1_5min', label: '1-5 minutes' },
          { value: '5_30min', label: '5-30 minutes' },
          { value: 'over_30min', label: 'Over 30 minutes' },
        ],
        width: 'half',
      },
      {
        key: 'equipment_required',
        label: 'Equipment Required',
        type: 'checkbox_group',
        options_source: 'equipment_registry',
        description: 'Equipment contributors need to perform this task',
        width: 'full',
      },
    ],
    conditional_fields: [
      {
        key: 'transcription_accuracy',
        label: 'Transcription Accuracy Target',
        type: 'select',
        required: true,
        description: 'Minimum acceptable accuracy for transcription output',
        options: [
          { value: '95', label: '95% — Standard' },
          { value: '98', label: '98% — High Quality' },
          { value: '99', label: '99% — Near Perfect' },
        ],
        show_when: { field: 'annotation_tasks', contains: 'transcription' },
        width: 'half',
      },
    ],
  },

  // 2. Image Annotation
  {
    task_type: 'image_annotation',
    display_name: 'Image Annotation',
    icon: 'Image',
    description: 'Annotate images with bounding boxes, polygons, semantic segmentation, or classification labels.',
    sort_order: 2,
    task_fields: [
      {
        key: 'annotation_method',
        label: 'Annotation Method',
        type: 'checkbox_group',
        required: true,
        description: 'Select all annotation methods required',
        options: [
          { value: 'bbox', label: 'Bounding Box', description: 'Draw rectangular boxes around objects' },
          { value: 'polygon', label: 'Polygon', description: 'Draw precise polygon outlines' },
          { value: 'segmentation', label: 'Semantic Segmentation', description: 'Pixel-level labeling of regions' },
          { value: 'classification', label: 'Image Classification', description: 'Assign categories to entire images' },
          { value: 'keypoint', label: 'Keypoint Detection', description: 'Mark specific points (e.g., joints, landmarks)' },
          { value: 'polyline', label: 'Polyline', description: 'Draw lines along paths or edges' },
        ],
        width: 'full',
      },
      {
        key: 'image_domain',
        label: 'Image Domain',
        type: 'select',
        required: true,
        options: [
          { value: 'autonomous_driving', label: 'Autonomous Driving / Street Scenes' },
          { value: 'medical', label: 'Medical Imaging' },
          { value: 'satellite', label: 'Satellite / Aerial Imagery' },
          { value: 'retail', label: 'Retail / Product Images' },
          { value: 'agriculture', label: 'Agriculture' },
          { value: 'document', label: 'Document / OCR' },
          { value: 'general', label: 'General Purpose' },
        ],
        width: 'half',
      },
      {
        key: 'images_per_day',
        label: 'Expected Images Per Day (per annotator)',
        type: 'number',
        required: true,
        placeholder: 'e.g., 200',
        description: 'Target throughput per contributor per day',
        validation: { min: 1, max: 50000 },
        width: 'half',
      },
      {
        key: 'label_classes',
        label: 'Label Classes',
        type: 'tags',
        required: true,
        placeholder: 'Type a label and press Enter (e.g., car, pedestrian, bicycle)',
        description: 'Define the label taxonomy for annotation',
        width: 'full',
      },
      {
        key: 'quality_control',
        label: 'Quality Control Method',
        type: 'select',
        required: true,
        options: [
          { value: 'consensus', label: 'Consensus (multiple annotators per image)' },
          { value: 'review', label: 'Expert Review (spot-check by reviewer)' },
          { value: 'honeypot', label: 'Honeypot (known-answer validation tasks)' },
          { value: 'hybrid', label: 'Hybrid (combination of methods)' },
        ],
        width: 'half',
      },
    ],
    conditional_fields: [
      {
        key: 'consensus_count',
        label: 'Annotators Per Image',
        type: 'number',
        required: true,
        description: 'Number of independent annotators per image for consensus',
        validation: { min: 2, max: 10 },
        show_when: { field: 'quality_control', equals: 'consensus' },
        width: 'half',
      },
      {
        key: 'review_sample_rate',
        label: 'Review Sample Rate (%)',
        type: 'number',
        description: 'Percentage of tasks to send to expert review',
        validation: { min: 1, max: 100 },
        show_when: { field: 'quality_control', equals: 'review' },
        width: 'half',
      },
    ],
  },

  // 3. Text Labeling
  {
    task_type: 'text_labeling',
    display_name: 'Text Labeling',
    icon: 'FileText',
    description: 'Classify, annotate, or label text data including sentiment analysis, NER, and content categorization.',
    sort_order: 3,
    task_fields: [
      {
        key: 'labeling_type',
        label: 'Labeling Type',
        type: 'checkbox_group',
        required: true,
        options: [
          { value: 'classification', label: 'Text Classification', description: 'Assign categories to text passages' },
          { value: 'ner', label: 'Named Entity Recognition', description: 'Identify and tag entities in text' },
          { value: 'sentiment', label: 'Sentiment Analysis', description: 'Rate sentiment polarity and intensity' },
          { value: 'relation', label: 'Relation Extraction', description: 'Identify relationships between entities' },
          { value: 'summarization_eval', label: 'Summarization Evaluation', description: 'Evaluate AI-generated summaries' },
          { value: 'toxicity', label: 'Toxicity / Safety Labeling', description: 'Flag harmful or inappropriate content' },
        ],
        width: 'full',
      },
      {
        key: 'label_taxonomy',
        label: 'Label Taxonomy',
        type: 'tags',
        required: true,
        placeholder: 'Enter label names (e.g., positive, negative, neutral)',
        description: 'Define the labels annotators will apply',
        width: 'full',
      },
      {
        key: 'domain_knowledge',
        label: 'Domain Knowledge Required',
        type: 'select',
        required: true,
        options: [
          { value: 'none', label: 'General / No Specific Domain' },
          { value: 'legal', label: 'Legal' },
          { value: 'medical', label: 'Medical / Healthcare' },
          { value: 'financial', label: 'Financial / Banking' },
          { value: 'technical', label: 'Technical / Engineering' },
          { value: 'academic', label: 'Academic / Research' },
          { value: 'ecommerce', label: 'E-commerce / Retail' },
          { value: 'social_media', label: 'Social Media' },
        ],
        width: 'half',
      },
      {
        key: 'text_length',
        label: 'Average Text Length',
        type: 'select',
        required: true,
        options: [
          { value: 'short', label: 'Short (1-2 sentences)' },
          { value: 'medium', label: 'Medium (paragraph)' },
          { value: 'long', label: 'Long (multiple paragraphs)' },
          { value: 'document', label: 'Full Document' },
        ],
        width: 'half',
      },
      {
        key: 'guidelines_url',
        label: 'Annotation Guidelines URL',
        type: 'text',
        placeholder: 'https://...',
        description: 'Link to detailed labeling guidelines document',
        validation: { pattern: '^https?://.*' },
        width: 'full',
      },
    ],
    conditional_fields: [
      {
        key: 'entity_types',
        label: 'Entity Types to Extract',
        type: 'tags',
        required: true,
        placeholder: 'e.g., PERSON, ORG, LOCATION, DATE',
        show_when: { field: 'labeling_type', contains: 'ner' },
        width: 'full',
      },
      {
        key: 'toxicity_categories',
        label: 'Toxicity Categories',
        type: 'checkbox_group',
        required: true,
        options: [
          { value: 'hate_speech', label: 'Hate Speech' },
          { value: 'harassment', label: 'Harassment' },
          { value: 'violence', label: 'Violence / Threats' },
          { value: 'sexual', label: 'Sexual Content' },
          { value: 'self_harm', label: 'Self-Harm' },
          { value: 'misinformation', label: 'Misinformation' },
        ],
        show_when: { field: 'labeling_type', contains: 'toxicity' },
        width: 'full',
      },
    ],
  },

  // 4. Data Collection
  {
    task_type: 'data_collection',
    display_name: 'Data Collection',
    icon: 'Database',
    description: 'Collect photos, voice recordings, handwriting samples, video, or other raw data from contributors.',
    sort_order: 4,
    task_fields: [
      {
        key: 'data_type',
        label: 'Data Type',
        type: 'checkbox_group',
        required: true,
        options: [
          { value: 'photos', label: 'Photos', description: 'Collect photographs meeting specific criteria' },
          { value: 'voice', label: 'Voice Recordings', description: 'Collect spoken audio samples' },
          { value: 'handwriting', label: 'Handwriting Samples', description: 'Collect handwritten text or drawings' },
          { value: 'video', label: 'Video Recordings', description: 'Collect video clips' },
          { value: 'text', label: 'Text / Written Responses', description: 'Collect written text data' },
          { value: 'screen_recording', label: 'Screen Recordings', description: 'Record screen interactions' },
        ],
        width: 'full',
      },
      {
        key: 'device_requirements',
        label: 'Device Requirements',
        type: 'checkbox_group',
        options: [
          { value: 'smartphone_android', label: 'Android Smartphone' },
          { value: 'smartphone_ios', label: 'iOS Smartphone' },
          { value: 'tablet', label: 'Tablet' },
          { value: 'desktop', label: 'Desktop Computer' },
          { value: 'webcam', label: 'Webcam' },
          { value: 'microphone', label: 'External Microphone' },
        ],
        description: 'Devices contributors need to participate',
        width: 'full',
      },
      {
        key: 'samples_per_contributor',
        label: 'Samples Per Contributor',
        type: 'number',
        required: true,
        placeholder: 'e.g., 50',
        description: 'Number of data samples each contributor should provide',
        validation: { min: 1, max: 10000 },
        width: 'half',
      },
      {
        key: 'demographic_requirements',
        label: 'Demographic Requirements',
        type: 'textarea',
        placeholder: 'Describe any specific demographic distributions needed (age, gender, accent, etc.)',
        description: 'Specify diversity or demographic balance requirements',
        width: 'full',
      },
      {
        key: 'collection_environment',
        label: 'Collection Environment',
        type: 'select',
        options: [
          { value: 'any', label: 'Any Environment' },
          { value: 'indoor', label: 'Indoor Only' },
          { value: 'outdoor', label: 'Outdoor Only' },
          { value: 'quiet', label: 'Quiet Environment Required' },
          { value: 'controlled', label: 'Controlled Setting (lab/studio)' },
        ],
        width: 'half',
      },
      {
        key: 'data_privacy_level',
        label: 'Data Privacy Level',
        type: 'select',
        required: true,
        options: [
          { value: 'public', label: 'Public — No PII' },
          { value: 'internal', label: 'Internal — Limited PII' },
          { value: 'confidential', label: 'Confidential — Contains PII' },
          { value: 'restricted', label: 'Restricted — Sensitive PII / Biometric' },
        ],
        width: 'half',
      },
    ],
    conditional_fields: [
      {
        key: 'photo_specifications',
        label: 'Photo Specifications',
        type: 'textarea',
        required: true,
        placeholder: 'Describe resolution, lighting, angle, subject requirements...',
        show_when: { field: 'data_type', contains: 'photos' },
        width: 'full',
      },
      {
        key: 'voice_specifications',
        label: 'Voice Recording Specifications',
        type: 'textarea',
        required: true,
        placeholder: 'Describe language, accent, script/prompts, duration per clip...',
        show_when: { field: 'data_type', contains: 'voice' },
        width: 'full',
      },
      {
        key: 'video_specifications',
        label: 'Video Specifications',
        type: 'textarea',
        required: true,
        placeholder: 'Describe resolution, frame rate, duration, scenario requirements...',
        show_when: { field: 'data_type', contains: 'video' },
        width: 'full',
      },
    ],
  },

  // 5. Guided Feedback (RLHF, preference ranking, safety eval)
  {
    task_type: 'guided_feedback',
    display_name: 'Guided Feedback',
    icon: 'MessageSquare',
    description: 'RLHF, preference ranking, safety evaluations, and other human feedback tasks for AI alignment.',
    sort_order: 5,
    task_fields: [
      {
        key: 'feedback_type',
        label: 'Feedback Type',
        type: 'select',
        required: true,
        options: [
          { value: 'rlhf', label: 'RLHF — Reinforcement Learning from Human Feedback' },
          { value: 'preference_ranking', label: 'Preference Ranking — Compare model outputs' },
          { value: 'safety_eval', label: 'Safety Evaluation — Red-teaming & guardrail testing' },
          { value: 'instruction_following', label: 'Instruction Following — Evaluate adherence' },
          { value: 'factuality', label: 'Factuality Checking — Verify claims & sources' },
        ],
        width: 'full',
      },
      {
        key: 'comparison_format',
        label: 'Comparison Format',
        type: 'select',
        required: true,
        options: [
          { value: 'side_by_side', label: 'Side-by-Side (A vs B)' },
          { value: 'ranked_list', label: 'Ranked List (order N items)' },
          { value: 'likert_scale', label: 'Likert Scale (rate each on a scale)' },
          { value: 'binary', label: 'Binary (thumbs up/down)' },
          { value: 'rubric', label: 'Rubric-Based (multi-dimension scoring)' },
        ],
        width: 'half',
      },
      {
        key: 'domain_expertise',
        label: 'Domain Expertise Required',
        type: 'select',
        required: true,
        options: [
          { value: 'general', label: 'General Knowledge' },
          { value: 'coding', label: 'Software Engineering / Coding' },
          { value: 'math', label: 'Mathematics / Reasoning' },
          { value: 'science', label: 'Science / Research' },
          { value: 'creative_writing', label: 'Creative Writing' },
          { value: 'legal', label: 'Legal' },
          { value: 'medical', label: 'Medical' },
          { value: 'multilingual', label: 'Multilingual / Translation' },
        ],
        width: 'half',
      },
      {
        key: 'model_under_eval',
        label: 'Model Being Evaluated',
        type: 'text',
        placeholder: 'e.g., GPT-4, Claude, internal model v2.3',
        description: 'Name or version of the model being evaluated (if applicable)',
        width: 'half',
      },
      {
        key: 'evaluation_criteria',
        label: 'Evaluation Criteria',
        type: 'tags',
        required: true,
        placeholder: 'e.g., helpfulness, harmlessness, honesty, relevance',
        description: 'Dimensions on which annotators will evaluate responses',
        width: 'full',
      },
    ],
    conditional_fields: [
      {
        key: 'attack_categories',
        label: 'Attack Categories',
        type: 'checkbox_group',
        required: true,
        options: [
          { value: 'jailbreak', label: 'Jailbreak Attempts' },
          { value: 'prompt_injection', label: 'Prompt Injection' },
          { value: 'bias_elicitation', label: 'Bias Elicitation' },
          { value: 'harmful_content', label: 'Harmful Content Generation' },
          { value: 'pii_extraction', label: 'PII Extraction' },
          { value: 'misinformation', label: 'Misinformation Generation' },
        ],
        show_when: { field: 'feedback_type', equals: 'safety_eval' },
        width: 'full',
      },
      {
        key: 'ranking_items_count',
        label: 'Number of Items to Rank',
        type: 'number',
        required: true,
        validation: { min: 2, max: 20 },
        description: 'How many model outputs to rank per task',
        show_when: { field: 'comparison_format', equals: 'ranked_list' },
        width: 'half',
      },
    ],
  },

  // 6. Transcription
  {
    task_type: 'transcription',
    display_name: 'Transcription',
    icon: 'Mic',
    description: 'Convert audio or video content to text, including translation and specialized transcription tasks.',
    sort_order: 6,
    task_fields: [
      {
        key: 'source_language',
        label: 'Source Language',
        type: 'select',
        required: true,
        options_source: 'languages_registry',
        description: 'The language spoken in the audio/video',
        width: 'half',
      },
      {
        key: 'target_language',
        label: 'Target Language (for translation)',
        type: 'select',
        options_source: 'languages_registry',
        description: 'Leave empty if transcription only (no translation)',
        width: 'half',
      },
      {
        key: 'audio_domain',
        label: 'Audio Domain',
        type: 'select',
        required: true,
        options: [
          { value: 'conversational', label: 'Conversational / Dialogue' },
          { value: 'broadcast', label: 'Broadcast / News' },
          { value: 'medical_dictation', label: 'Medical Dictation' },
          { value: 'legal_proceedings', label: 'Legal Proceedings' },
          { value: 'technical', label: 'Technical / Scientific' },
          { value: 'customer_service', label: 'Customer Service Calls' },
          { value: 'lecture', label: 'Lectures / Presentations' },
          { value: 'entertainment', label: 'Entertainment / Media' },
        ],
        width: 'half',
      },
      {
        key: 'transcription_style',
        label: 'Transcription Style',
        type: 'button_group',
        required: true,
        default_value: 'clean',
        options: [
          { value: 'verbatim', label: 'Verbatim', description: 'Include all speech disfluencies, false starts, filler words' },
          { value: 'clean', label: 'Clean', description: 'Edited for readability while preserving meaning' },
          { value: 'intelligent', label: 'Intelligent', description: 'Summarized and restructured for clarity' },
        ],
        width: 'full',
      },
      {
        key: 'timestamps_required',
        label: 'Timestamps Required',
        type: 'select',
        required: true,
        options: [
          { value: 'none', label: 'No Timestamps' },
          { value: 'segment', label: 'Segment-level (every few sentences)' },
          { value: 'sentence', label: 'Sentence-level' },
          { value: 'word', label: 'Word-level' },
        ],
        width: 'half',
      },
      {
        key: 'speaker_identification',
        label: 'Speaker Identification',
        type: 'toggle',
        toggle_label: 'Label each speaker separately (e.g., Speaker 1, Speaker 2)',
        width: 'full',
      },
    ],
    conditional_fields: [
      {
        key: 'translation_quality',
        label: 'Translation Quality Standard',
        type: 'select',
        required: true,
        options: [
          { value: 'machine_post_edit', label: 'Machine Translation + Post-Editing' },
          { value: 'human_translation', label: 'Full Human Translation' },
          { value: 'certified', label: 'Certified Translation' },
        ],
        show_when: { field: 'target_language', not_equals: null },
        width: 'half',
      },
      {
        key: 'medical_specialty',
        label: 'Medical Specialty',
        type: 'select',
        options: [
          { value: 'general', label: 'General Practice' },
          { value: 'radiology', label: 'Radiology' },
          { value: 'pathology', label: 'Pathology' },
          { value: 'cardiology', label: 'Cardiology' },
          { value: 'oncology', label: 'Oncology' },
          { value: 'psychiatry', label: 'Psychiatry' },
        ],
        show_when: { field: 'audio_domain', equals: 'medical_dictation' },
        width: 'half',
      },
    ],
  },

  // 7. Other
  {
    task_type: 'other',
    display_name: 'Other',
    icon: 'MoreHorizontal',
    description: 'Custom or uncategorized task type. Describe your needs in the free-text field below.',
    sort_order: 7,
    task_fields: [
      {
        key: 'task_description',
        label: 'Task Description',
        type: 'textarea',
        required: true,
        placeholder: 'Describe the task in detail: what needs to be done, what skills are needed, expected output format, quality criteria, etc.',
        description: 'Provide a thorough description of the task since no structured fields are available for this type.',
        validation: { min_length: 50, max_length: 10000 },
        width: 'full',
      },
    ],
    conditional_fields: [],
  },
];

// ============================================================
// OPTION REGISTRIES
// ============================================================

interface RegistryEntry {
  value: string;
  label: string;
  metadata?: Record<string, unknown>;
}

const LANGUAGES_REGISTRY: RegistryEntry[] = [
  { value: 'ar', label: 'Arabic', metadata: { direction: 'rtl' } },
  { value: 'zh-CN', label: 'Chinese (Simplified)', metadata: { region: 'CN' } },
  { value: 'zh-TW', label: 'Chinese (Traditional)', metadata: { region: 'TW' } },
  { value: 'da', label: 'Danish' },
  { value: 'nl', label: 'Dutch' },
  { value: 'en-US', label: 'English (US)', metadata: { region: 'US' } },
  { value: 'en-GB', label: 'English (UK)', metadata: { region: 'GB' } },
  { value: 'fi', label: 'Finnish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'el', label: 'Greek' },
  { value: 'he', label: 'Hebrew', metadata: { direction: 'rtl' } },
  { value: 'hi', label: 'Hindi' },
  { value: 'id', label: 'Indonesian' },
  { value: 'it', label: 'Italian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ms', label: 'Malay' },
  { value: 'no', label: 'Norwegian' },
  { value: 'pl', label: 'Polish' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)', metadata: { region: 'BR' } },
  { value: 'pt-PT', label: 'Portuguese (Portugal)', metadata: { region: 'PT' } },
  { value: 'ro', label: 'Romanian' },
  { value: 'ru', label: 'Russian' },
  { value: 'es', label: 'Spanish' },
  { value: 'sv', label: 'Swedish' },
  { value: 'tl', label: 'Tagalog' },
  { value: 'ta', label: 'Tamil' },
  { value: 'th', label: 'Thai' },
  { value: 'tr', label: 'Turkish' },
  { value: 'uk', label: 'Ukrainian' },
  { value: 'vi', label: 'Vietnamese' },
  { value: 'bn', label: 'Bengali' },
  { value: 'cs', label: 'Czech' },
  { value: 'yue', label: 'Cantonese' },
];

const REGIONS_REGISTRY: RegistryEntry[] = [
  { value: 'MA', label: 'Morocco', metadata: { continent: 'Africa' } },
  { value: 'EG', label: 'Egypt', metadata: { continent: 'Africa' } },
  { value: 'NG', label: 'Nigeria', metadata: { continent: 'Africa' } },
  { value: 'ZA', label: 'South Africa', metadata: { continent: 'Africa' } },
  { value: 'BR', label: 'Brazil', metadata: { continent: 'South America' } },
  { value: 'AR', label: 'Argentina', metadata: { continent: 'South America' } },
  { value: 'CO', label: 'Colombia', metadata: { continent: 'South America' } },
  { value: 'PE', label: 'Peru', metadata: { continent: 'South America' } },
  { value: 'CL', label: 'Chile', metadata: { continent: 'South America' } },
  { value: 'MX', label: 'Mexico', metadata: { continent: 'North America' } },
  { value: 'US', label: 'United States', metadata: { continent: 'North America' } },
  { value: 'IN', label: 'India', metadata: { continent: 'Asia' } },
  { value: 'PH', label: 'Philippines', metadata: { continent: 'Asia' } },
  { value: 'JP', label: 'Japan', metadata: { continent: 'Asia' } },
  { value: 'KR', label: 'South Korea', metadata: { continent: 'Asia' } },
  { value: 'CN', label: 'China', metadata: { continent: 'Asia' } },
  { value: 'ID', label: 'Indonesia', metadata: { continent: 'Asia' } },
  { value: 'TH', label: 'Thailand', metadata: { continent: 'Asia' } },
  { value: 'VN', label: 'Vietnam', metadata: { continent: 'Asia' } },
  { value: 'MY', label: 'Malaysia', metadata: { continent: 'Asia' } },
  { value: 'SG', label: 'Singapore', metadata: { continent: 'Asia' } },
  { value: 'PK', label: 'Pakistan', metadata: { continent: 'Asia' } },
  { value: 'BD', label: 'Bangladesh', metadata: { continent: 'Asia' } },
  { value: 'SA', label: 'Saudi Arabia', metadata: { continent: 'Asia' } },
  { value: 'AE', label: 'United Arab Emirates', metadata: { continent: 'Asia' } },
  { value: 'TR', label: 'Turkey', metadata: { continent: 'Asia' } },
  { value: 'DE', label: 'Germany', metadata: { continent: 'Europe' } },
  { value: 'GB', label: 'United Kingdom', metadata: { continent: 'Europe' } },
  { value: 'FR', label: 'France', metadata: { continent: 'Europe' } },
  { value: 'RU', label: 'Russia', metadata: { continent: 'Europe' } },
];

const EQUIPMENT_REGISTRY: RegistryEntry[] = [
  { value: 'headphones', label: 'Headphones', metadata: { category: 'audio' } },
  { value: 'microphone', label: 'External Microphone', metadata: { category: 'audio' } },
  { value: 'quiet_environment', label: 'Quiet Environment', metadata: { category: 'environment' } },
  { value: 'webcam', label: 'Webcam', metadata: { category: 'video' } },
  { value: 'smartphone', label: 'Smartphone', metadata: { category: 'device' } },
  { value: 'specific_os', label: 'Specific OS (Windows/macOS/Linux)', metadata: { category: 'device' } },
  { value: 'desktop_computer', label: 'Desktop Computer', metadata: { category: 'device' } },
  { value: 'high_speed_internet', label: 'High-Speed Internet (25+ Mbps)', metadata: { category: 'connectivity' } },
];

const SKILLS_REGISTRY: RegistryEntry[] = [
  { value: 'active_listening', label: 'Active Listening', metadata: { category: 'soft_skill' } },
  { value: 'attention_to_detail', label: 'Attention to Detail', metadata: { category: 'soft_skill' } },
  { value: 'language_fluency', label: 'Language Fluency', metadata: { category: 'language' } },
  { value: 'typing_speed', label: 'Fast Typing Speed (60+ WPM)', metadata: { category: 'technical' } },
  { value: 'transcription', label: 'Transcription Experience', metadata: { category: 'technical' } },
  { value: 'domain_expertise', label: 'Domain Expertise', metadata: { category: 'knowledge' } },
  { value: 'image_labeling', label: 'Image Labeling Experience', metadata: { category: 'technical' } },
  { value: 'data_entry', label: 'Data Entry', metadata: { category: 'technical' } },
  { value: 'quality_assessment', label: 'Quality Assessment', metadata: { category: 'analytical' } },
  { value: 'conversational_analysis', label: 'Conversational Analysis', metadata: { category: 'analytical' } },
  { value: 'linguistic_annotation', label: 'Linguistic Annotation', metadata: { category: 'language' } },
  { value: 'video_editing', label: 'Video Editing', metadata: { category: 'technical' } },
];

// ============================================================
// SEED FUNCTION
// ============================================================

export async function seedDatabase(): Promise<void> {
  const sql = getDb();

  // Seed task type schemas
  for (const schema of TASK_TYPE_SCHEMAS) {
    // Phase A (2026-04-08): Prepend the shared Job Requirements fields to
    // every task type's task_fields so they render in every intake form.
    const taskFieldsWithJobRequirements: FieldDefinition[] = [
      ...JOB_REQUIREMENTS_FIELDS,
      ...schema.task_fields,
    ];

    const schemaPayload = JSON.stringify({
      base_fields: BASE_FIELDS,
      task_fields: taskFieldsWithJobRequirements,
      conditional_fields: schema.conditional_fields,
      common_fields: COMMON_FIELDS,
    });

    await sql`
      INSERT INTO task_type_schemas (task_type, display_name, icon, description, schema, version, is_active, sort_order, created_by)
      VALUES (
        ${schema.task_type},
        ${schema.display_name},
        ${schema.icon},
        ${schema.description},
        ${schemaPayload}::jsonb,
        1,
        TRUE,
        ${schema.sort_order},
        'system'
      )
      ON CONFLICT (task_type) DO NOTHING
    `;
  }

  // Seed option registries
  const registries: Array<{ name: string; entries: RegistryEntry[] }> = [
    { name: 'languages_registry', entries: LANGUAGES_REGISTRY },
    { name: 'regions_registry', entries: REGIONS_REGISTRY },
    { name: 'equipment_registry', entries: EQUIPMENT_REGISTRY },
    { name: 'skills_registry', entries: SKILLS_REGISTRY },
  ];

  for (const registry of registries) {
    for (let i = 0; i < registry.entries.length; i++) {
      const entry = registry.entries[i];
      const metadataJson = entry.metadata ? JSON.stringify(entry.metadata) : null;

      await sql`
        INSERT INTO option_registries (registry_name, option_value, option_label, metadata, sort_order, is_active)
        VALUES (
          ${registry.name},
          ${entry.value},
          ${entry.label},
          ${metadataJson}::jsonb,
          ${i},
          TRUE
        )
        ON CONFLICT (registry_name, option_value) DO NOTHING
      `;
    }
  }
}
