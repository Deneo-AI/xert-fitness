// ─── XERT Fitness Independent Contractor Agreement ──────────────────────────
// The wording of the paper agreement personal and group trainers sign, kept
// here so the digital form and anything else that needs to quote it read from
// one source. Transcribed from the signed PDF; the wording is deliberately
// left as the club wrote it, because this is the document people agree to.

export const XERT_CONTRACTOR_TITLE = 'XERT Fitness Independent Contractor Agreement';
export const XERT_CONTRACTOR_SUBTITLE = 'Personal & Group Trainers';

export const XERT_CONTRACTOR_PARTIES = `This agreement commences on the date you sign it and continues until terminated in accordance with this agreement.

In this agreement, "XERT Fitness", "Xert", "we", "us", "The Club", "The Owner" and "our" mean Byron Hawley trading as XERT Fitness ABN 65 327 079 634 of Shop 14/15 27-31 Pound St, Kingaroy, QLD, 4610. "You" and "Your", "The Independent Contractor", "The Trainer", "Personal Trainer", "Group Fitness Instructor" or "The Group Trainer" mean the independent contractor identified below.

The Independent Contractor agrees to engage in a relationship with Xert Fitness, as outlined in detail below, and understands that this agreement is not an employment agreement.`;

export const XERT_CONTRACTOR_QUALIFICATIONS = Object.freeze([
  'Public Liability & Indemnity Insurance',
  'Cert III (acceptable if undertaking group fitness only)',
  'Cert IV or higher qualification, i.e. Exercise Science (if undertaking personal training)',
  'CPR Certificate',
  'First Aid Certificate',
  'Blue Card (14 year olds are permitted to engage in group classes; required up to 17 years)',
]);

// Pty Ltd is a proprietary limited company, Ltd a public one. A sole trader
// is neither, which is why leaving this blank has to stay an answer.
export const XERT_CONTRACTOR_BUSINESS_TYPES = Object.freeze([
  'Pty Ltd',
  'Ltd',
]);

export const XERT_CONTRACTOR_SERVICES = Object.freeze([
  'Group Fitness & Personal Training',
  'Group Fitness Only',
  'Personal Training Only',
]);

/** Every clause block, in the order they appear on the paper agreement. */
export const XERT_CONTRACTOR_SECTIONS = Object.freeze([
  {
    id: 'ic-10-suitability',
    title: 'Job Suitability and Training (Group Trainers Only)',
    points: [
      'Given that Xert Fitness provides specialist functional training which differs from a commercial gym, the owner requires that you are competent in a variety of movement and performance tasks prior to being experienced enough to run one of Xert Fitness’s group classes without assistance.',
      'By signing this agreement, you agree to follow this training process which consists of four assisted group sessions and sign off over one fortnight, along with achieving competency in a questionnaire and physical assessment session with the owner. You will be paid for these four assisted group sessions, which may be reflected in your first paid invoice or a separate direct transfer from the owner.',
    ],
  },
  {
    id: 'ic-20-access',
    title: 'Opening and Closing Procedures | Club Access | Processing Casual Visits & Memberships',
    points: [
      'You will be provided with a free membership to the value of Full Access $39 per week during your time with us. You can come and go at any time and on any day, with the exception of a specific day for any reason the owner has advised not to come into the club. As part of this free membership with us, you need to complete the Pre-Exercise Waiver and also sign our club’s Terms and Conditions. If you do not complete either of these documents, we will be unable to engage in this agreement with you. We will review the Pre-Exercise Waiver prior to signing this agreement, in the case that anything further needs to be cross checked or discussed before moving forward.',
      'There is a lock box out the front of the facility with the keys to access inside, with an air tag attached. Once you have opened the facility, you are to return the key to the lock box and securely lock it. The key is not to be left out around the gym at any time.',
      'We ask that you complete the few tasks outlined on the sign on and sign off registers, requesting your signature and the date you accessed the club. Please file these in the folder they were sourced from and do not leave them loosely lying around.',
      'The Independent Contractor is not permitted to grant entry to anyone who has not signed the Pre-Exercise Health Waiver or paid to be in the facility, and is required to assist new customers with this simple sign in process by pointing them to the QR code signs in reception to access the payment / membership sign up links and / or the Pre-Exercise Health Waiver. You can assist them to complete this on their own phone via the links we have provided to you or displayed on our Instagram. We do not permit you to use your own phone to take any customer payments, or for participants or members to complete the Pre-Exercise Health Waiver or Club Terms and Conditions. A payment receipt presented on the attendee’s phone is sufficient to confirm payment.',
      'The Independent Contractor will be provided with access to the workable record of who has signed the Pre-Exercise Waiver. They are required to check against this list that the customer or member has their name recorded, or has sighted their hard copy in the aqua folder labelled ‘Signed Waivers’, before allowing them access to the club. If their name is not on the list, the Independent Contractor is required to have them sign a hard copy on the front desk and file this into the aqua folder, or complete a digital copy via the QR code / Instagram link and make sure the participant has received the confirmation email. Checking if the participant’s health waiver has been signed is not considered an administrative duty by us, but rather a compulsory safety and legal requirement.',
      'Personal Trainers only: You are not required to process any casual visit fees or new memberships outside of your direct clients, who are required to separately pay you as per your terms of service. However, these clients, or their parent or guardian, must sign up to the ‘Training with Personal Trainer only’ membership with us for $10.60, or Full Access Membership for $39 per week, immediately when first signing up, and complete the Pre-Exercise Waiver and Terms and Conditions. This fee contributes towards Xert Fitness expenses including equipment maintenance, rent, electricity and water. Xert Fitness must sign Personal Trainers’ clients up in the database and our administrative system, to be able to manage your and our clients’ weekly payments and store administrative records.',
      'Personal Trainers only: We expect that you have taken reasonable lengths to cross check the health records of the clients you are bringing into the facility, by way of them having completed and signed our Pre-Exercise Health Waiver and Terms and Conditions, along with your own terms and conditions, which Xert Fitness is not bound by and which stand separate from ours.',
      'Personal Trainers only: You are granted 24/7 access to train your clients at a time of their or your choosing, which may be outside of the standard group class hours.',
      'The Independent Contractor agrees to photograph or video record any damage that may have been caused to the facility in relation to a break in, and contact the owner immediately on 0431 676 053.',
      'If the premises cannot be opened or closed securely, including but not limited to any issues with the lock box, you agree to contact the owner immediately on 0431 676 053 and wait for further instruction.',
    ],
  },
  {
    id: 'ic-30-safety',
    title: 'Workplace Health & Safety | Indemnities | Liability',
    points: [
      'If you notice a member or participant not engaging in safe practice, you are required to voice your concerns to them immediately and as privately as possible. You are responsible for the participant’s or member’s safety and wellbeing whilst they are under your instruction. If their behaviour continues, the club owner must be contacted immediately (if they do not answer, send an SMS to 0431 676 053), along with the participant’s or member’s guardian or parent if under 18 years of age.',
      'If you are found to be engaging in unsafe conduct, Xert Fitness will address this with you immediately, either the owner or another member of Xert Fitness staff. If repeated unsafe conduct continues, or depending on the seriousness of the initial misconduct, you may be issued a written warning via email to stop the behaviour, or Xert Fitness may look to terminate this agreement with you.',
      'If a member or participant requires CPR or First Aid, you must attend to their needs and not permit another person in the facility to do so unless they are qualified.',
      'Your safety and the safety of other staff and members is of utmost importance to us, and we may from time to time introduce reasonable health and safety measures to ensure the safety of you, our members and our staff. If we make any reasonable health and safety measure a condition of entry and you refuse to comply, you may not be permitted to enter the Club at our discretion, unless a medical exemption applies and we are provided with appropriate supporting documents.',
      'If an incident occurs taking the form of injury, safety, illness, near miss, maintenance, or you notice property damage, an Incident Report is required to be completed by you or another Xert staff member working in the facility at the time. Blank forms are in the blue folder on the top of the front desk to the right. Once completed, an image must be taken of both pages and emailed to info@xertfitness.com.au. If urgent, the owner must be notified as soon as possible by calling 0431 676 053; if minor, sending an SMS is acceptable. We ask that you please remove the paperwork from your private phone camera roll once you know we have received it successfully.',
      'In the event of the need to evacuate, please make reference to the evacuation policy located on the wall in the front reception and at the back of the facility near the toilet, and direct all members and participants in the facility.',
      'The Independent Contractor indemnifies and holds harmless XERT Fitness, its owner, employees and representatives against any loss, damage, liability, claim, penalty, cost or expense, including reasonable legal costs, arising from or in connection with the Independent Contractor’s negligence, misconduct, unlawful act or omission, or breach of this Agreement. This indemnity applies only to the extent that the loss was caused or contributed to by the Independent Contractor, and does not apply to the extent that the loss was caused or contributed to by the negligence, misconduct or breach of XERT Fitness.',
      'The Independent Contractor is liable only for loss, damage, liability, claims, costs or expenses to the extent caused or contributed to by the Independent Contractor’s negligence, misconduct, unlawful act or omission, or breach of this Agreement. The Independent Contractor is not liable to the extent that the loss was caused or contributed to by XERT Fitness, its owner, employees, agents or other independent contractors. Nothing in this Agreement excludes or limits either party’s liability where that liability cannot lawfully be excluded or limited.',
    ],
  },
  {
    id: 'ic-40-conduct',
    title: 'Appearance & Presentation | Drug & Alcohol Policy | Serious Misconduct',
    points: [
      'We ask that you uphold personal hygiene and a professional standard when conducting work at our gym. This includes but is not limited to wearing shoes that are not heavily worn and do not have holes, shirts that also do not have holes and are not heavily creased, and gym shorts of a reasonable length — no jeans, track pants or anything other than gym wear. We ask that long hair is tied back, that sunglasses are not worn inside the facility, and that make up is light or not worn.',
      'Independent Contractors or any staff found to be under the influence of drugs or alcohol will be sent home effective immediately, with written notice following via email or SMS for further instruction regarding return to work, final classes, access, return of Xert Fitness property, or Xert Fitness’s proposal to cancel this agreement.',
      'Anything determined by Xert Fitness’s owner as ‘serious misconduct’ may terminate this agreement effective immediately. Such instances could include harming a member or participant in any way, or stealing from members including the lost and found box, or stealing from Xert Fitness physically or by digital means. Other instances could include but are not limited to damaging equipment or the facility in any way, or putting Xert Fitness’s brand and reputation at risk in person or online.',
    ],
  },
  {
    id: 'ic-50-children',
    title: 'Children & Those Under 14 Years of Age',
    points: [
      'The Independent Contractor understands Xert Fitness’s Child Policy as outlined in section 6, General Conditions of Entry & Club Code, and section 12, Children, of the Terms and Conditions. You are required to read this to understand the terms and conditions XERT Fitness requires you to follow, and to be aware of how we operate, and to understand that the terms might change from time to time and we will do our best to keep you informed. We display our child policy on the wall in our front reception.',
      'You are only permitted to train children from the age of fourteen and up in our facility.',
      'A minor must be accompanied by their parent, legal guardian, suitably qualified personal trainer or group fitness instructor, or other approved exercise professional with parental or legal guardian consent. This consent is reflected on the Pre-Exercise Waiver and the last page of the Membership Terms and Conditions.',
      'You are not able to cancel a minor’s membership with us regarding any inappropriate behaviour, misuse of equipment or failure to comply with safety requirements. Please make reference to our workplace health and safety directives in this agreement. Xert Fitness is directly responsible for issuing and actioning any cancellation. You are required to report your concerns to us immediately in writing via email.',
      'Memberships held in a 14 to 17 year old’s name must have their parent’s or guardian’s payment details recorded.',
    ],
  },
  {
    id: 'ic-60-privacy',
    title: 'Privacy | Marketing Permissions | Marketing Your Services | Lead Generation',
    points: [
      'Your personal information and the information of Xert Fitness’s members, participants and other staff (as that term is defined in the Privacy Act 1988 (Cth)), if provided to us by you, will only be used by Xert Fitness in accordance with the provisions of our Privacy Statement. By signing this agreement, you agree to follow Xert Fitness’s privacy policy, outlining how member and participant private information is handled. The Xert Fitness Privacy Statement can be obtained on our website. If you are found to be at fault in following the privacy policy, we will issue you with written notice by email and, depending on the seriousness of the circumstances, we may terminate this agreement with you.',
      'You are not permitted to take any of Xert Fitness’s physical paperwork out of the facility, or photograph anything and store it on your phone. If the owner asks that you photograph something on their phone, you are allowed to do this, but not to send it on to yourself or anyone other than as the owner directs.',
      'We sometimes film or photograph in the Club, so it is possible you, your clients, participants or members will appear in the background or in direct images and videos. By selecting the marketing consent option at the end of this agreement, you allow us to use your image in promotional and other business related marketing material.',
      'There are several people who are currently members who do not consent to our marketing policy by way of images or videos featuring them being shared for marketing purposes. We will continue to update you on any members who do not consent to our marketing policy in writing.',
      'We will not provide your personal information or contact details to unrelated third parties.',
      'We encourage you to create posters to market your personal training or other fitness related services in our gym. You are permitted to prepare a poster to present to us for approval. If there are any issues with the content or words used in your marketing material, we will have a conversation with you about it before we approve it. You can email us or SMS a photo of your poster to the owner. Once approved, you can display this one poster on the walls in the front of the club.',
      'Personal Trainers only: We may receive personal training enquiries through the website from time to time. If you are the only personal trainer with us, we will pass the majority of enquiries through to you. We do not guarantee any leads for you and are not obliged to provide you with any as part of your agreement with us.',
      'Group Trainers only: We ask that you wear the Xert Fitness shirt provided when conducting group training sessions.',
      'Personal Trainers only: We ask that you please wear your own gym clothes, advertising your own fitness brand or business, when training clients.',
      'You are encouraged to create content on your own social accounts and invite Xert Fitness to collaborate. Inviting Xert Fitness to collaborate on your content does not automatically mean it will be approved and reshared on our social pages.',
      'You agree to keep Xert Fitness’s private business information, provided to you during meetings, at any time you are in the facility, or from any digital communications, confidential, and will not disclose this information to anyone working outside of Xert Fitness or to any of our participants or members.',
    ],
  },
  {
    id: 'ic-70-property',
    title: 'Theft | Damage | Lost Property',
    points: [
      'In line with the sign off register, all items left behind in the pigeon holes at the end of the day are to be removed and stored in the Lost Property box in the back office. You are not permitted to dispose of any of these items or remove them from the premises. Xert Fitness removes these items every three months.',
      'You are not permitted to remove, or allow your clients or Xert Fitness members to remove, any equipment or resources from the facility, or to bring their own equipment in, without first receiving approval from the owner.',
    ],
  },
  {
    id: 'ic-80-training-times',
    title: 'When To Train Your Clients | Complimentary Trials (Personal Trainers Only)',
    points: [
      'We ask that you mostly organise to train your clients outside of our class hours, which are held Monday to Friday 5:00 – 7:30 am, 9:15 – 10:45 am and 4:15 – 6:45 pm, and on weekends outside of 7:45 – 9:15 am and 2:15 – 3:45 pm. However, you are permitted to train a client one on one during these times, provided you can do so in a way that does not interfere with the group class in session. This also applies to your own individual training.',
      'The owner sets up equipment for the next day’s class the night before on most occasions. We ask that if you must use equipment that has been set up for the group sessions, you return it to the same spot from where you took it. Equipment set up for group classes is considered separate to your personal training session and is not to be used by your client or yourself without first setting it up appropriately.',
      'You are only permitted to train a maximum of 12 clients at once. If you want to train more than 12, you need to provide advance notice of 3 business days to the owner in order for him to be available to assist in the training. The owner will provide this free of charge to you for the duration of the set session, as per the notice provided in advance.',
      'If Personal Trainers choose to conduct free personal training sessions initially as a consultation, or thereafter for any other reason the trainer feels appropriate, this is at the discretion of the individual Personal Trainer, and Xert Fitness and its owner are in no way liable to pay the trainer or the trainer’s client in such circumstances.',
    ],
  },
  {
    id: 'ic-90-guided',
    title: 'Guided Training Sessions Participation',
    points: [
      'You understand that this offer is open to all membership types and staff or independent contractors, to be guided through training exercises to help them better perform the exercises run through in the group classes. These sessions aim to prevent injury, make the classes easier to follow, and help members feel more confident when performing the exercises.',
      'You understand the monthly group coaching session shall be conducted at the end of the 8:00 am Sunday morning session for a further 30 minutes, and is subject to the availability of the fitness professional. You can host these sessions if asked by the owner, or if you volunteer and the owner approves. We expect you to record your time for payment against the invoice that falls on the fortnight of the session so that you can be paid.',
    ],
  },
  {
    id: 'ic-100-ending',
    title: 'Cancelling Memberships | Your Agreement | If You Choose To Leave Us | Entitled Leave',
    points: [
      'You understand this relationship is ongoing until such time as you choose to no longer provide your service to Xert Fitness, or because of any other reason. You can terminate this agreement with two weeks’ notice in writing via email.',
      'Taking time off is unlimited and to your own liking and needs, and we ask that you provide as much notice as possible to us in writing where you can.',
      'Personal Trainers only: When giving two weeks’ notice in relation to your request to terminate this agreement, we ask that the applicable rent be paid to us for this period, either $100 x 2 or $150 x 2, which can be paid on or before the date the two weeks finishes. Please send proof of payment to our email address.',
      'You understand that you are not able to cancel a member’s membership, and that you need to notify the owner if your client no longer wants to continue their training agreement with you or our club.',
      'If you no longer work with us, we will contact your client to see if they want to upgrade or cancel the membership they hold with us. You are to inform your client that cancellation of their agreement with you does not mean cancellation of their agreement with Xert Fitness.',
      'You are required to return all Xert Fitness property at the end of this agreement, including but not limited to the Xert shirt and any keys to access the facility, along with any outstanding rent owing. You understand that you will no longer have access to any of Xert Fitness’s systems, including but not limited to the record of members and participants who have signed the Pre-Exercise Health Waiver.',
      'If you are unable to return any of the equipment you borrowed from Xert, such as a shirt or access key, we will bill you for these items if we have not deducted them from your last invoice paid.',
      'If you become bankrupt or insolvent, or enter administration or liquidation during your time with us, the two weeks’ notice will not apply to you, and we will only require that you pay us rent up to the date you notified us in writing of your change of circumstances.',
      'We ask that if you no longer work with us, you do not continue to create content or use our logo for any marketing on any social media accounts that you own or are associated with.',
      'If you have any suggestions for improvement or anything else, please voice these to the owner directly or email them to info@xertfitness.com.au.',
    ],
  },
  {
    id: 'ic-110-rent',
    title: 'Paying Rent | Invoicing | Fees Charged for Club Use | Unpaid Rent',
    points: [
      'Personal Trainers only: You are entitled to forgo paying rent to the facility for 4 weeks per 12 months with Xert Fitness. If you become ill or there is a significant change to your circumstances, as proven by a medical certificate or otherwise, we will suggest using this rent free offer during this period if you have not already made use of it. This proposal cannot be exchanged for cash or any other offer. If you are ill or face significant change beyond this 4 week period, a conversation can be had with Byron Hawley to decide how best to accommodate you. These rent free weeks do not carry over into the following year and must be used in the initial 12 months from the commencement date of this agreement.',
      'Personal Trainers only: Xert Fitness is not liable for any charges you have taken from your client in their absence from personal training sessions. We do not receive your client’s money directly in regard to the training session. Your personal training fee is a separate cost. You are required to manage your client’s personal situation in such circumstances against your own records. We only manage and are responsible for the membership fee we ask them to pay.',
      'Personal Trainers only: You will be paid directly from members for the additional service, and you need to manage these payments and your payment process. Xert Fitness is not responsible for your client payments, payment process, income tax, superannuation, or any communication between yourself and your client.',
      'Personal Trainer and Group Fitness Instructor: If the Group Fitness Instructor is also conducting personal training, the owner will deduct $100 from the invoice you issue to us for the group classes conducted over the fortnight, at a price to be determined per class. Fifteen minutes either side of group class blocks, or individual classes at 9:30 am only, is to be paid regarding pack up, member interaction and pack down. The invoice period will start on the closest Friday to you starting with us and carry over to the following Friday.',
      'Personal Trainer and Group Fitness Instructor: If you are personal training and group fitness instructing and have not worked enough group fitness classes in the fortnight to amount to the $100 rent owed, then a record will be made against your group fitness instructor’s payment receipt in reference to a debit, which will then be carried over to the next invoice. We ask that you please make a record of this on your new invoice. If you submit an invoice missing this debit, Xert Fitness will correct you in an email response and require that you resubmit the amended invoice as soon as possible.',
      'Personal Trainers only: In order for you to pay XERT Fitness rent, the owner requires the Independent Contractor to set up a direct debit transfer through your selected bank, using the account details provided to you by the owner and your name as recorded on this agreement. We ask that this direct debit be established to fall on the Friday of each fortnight.',
      'Personal Trainers only: If you have failed to pay Xert Fitness rent on four occasions in a 12 month period (with the exemption of the 4 weeks free rent period per 12 months), Xert Fitness will reconsider this agreement with you by speaking with you primarily in writing via email. If you appear to be unable or unwilling to pay the outstanding rent owed, Xert Fitness will issue you with a notice to finish up on the date that would fall on the following Friday of the fortnight, and to return anything that belongs to us. You understand that until the outstanding rent is paid, or items we loaned to you are returned, we will not be reconsidering you entering into a new agreement with us.',
      'Personal Trainers only: Xert Fitness might change the rent fee once the new financial year begins. In the case that it does, you will be notified in writing by email 30 days prior to this change taking effect, giving you the opportunity to cancel if you choose, or to raise any questions or concerns prior to the change taking effect.',
    ],
  },
  {
    id: 'ic-120-changes',
    title: 'When A New Copy Of This Agreement Must Be Signed',
    points: [
      'A new copy of this agreement must be signed when changing from Personal Trainer to Group Trainer; when changing from Group Trainer to Personal Trainer; when adding the responsibility to train group classes whilst still personal training; when adding the responsibility to do personal training whilst conducting group classes; or when choosing to no longer conduct group classes and / or personal training at the same time, and to just provide one of these services.',
      'The date the Independent Contractor changed the nature of the service they provide needs to be amended, and the service selection above further requires an amendment.',
    ],
  },
]);

/** One clause block as the paragraph a reader sees. */
export function contractorSectionText(section) {
  return (section?.points || []).map(point => `• ${point}`).join('\n\n');
}
