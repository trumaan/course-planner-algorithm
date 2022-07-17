/**
 * TODO LONG TERM
 *  - implement requirements checker (based on program requirements)
 *  1/2 done - implement select program front-end, display only programs within json file
 */

/** 
 * CURRENT STATUS
 *  - problem: seems that running scraper for whole program will be too slow
 *  - implentation idea: run scraper for all programs (only some for now, scale after)
 *     - keep large json file of of all stored courses
 *     - when add course, first search in json file, then use scraper
 *     - do similiarly with a large programs json file (each program should contain it's prereqs/required courses for each year)
 * 
 * CURRENT TODO
 *  - create all-courses.json and all-programs.json
 *  - implement the implementation idea
 *  - fill json files with all engineering programs, and associated courses
 *  - 
 *  - implement add course block (set data and generate div)
 *  - implement set program (adds all courses within program to associated years)
 *  - 
 *  - implement generate schedule - drag and drop, set as work term, create schedule algorithm, and more...
 */



import {meetsPrereqs, addAssumeCompleted} from './meetsPrereqs.js'

/**  
 * INITIALIZE APP
 *  - set all global variables
 *  - create course and term blocks
 */

let coursesSessionData = null;


async function init(){
  // create term blocks
  createTermBlock(18); // 6 years of terms

  // fetch json data in all_programs.json
  // keep as constant
  // within courses of program - fetch all course datas needed from all_courses.json
  // for each course, create course block
  const PROGRAM = "Software Engineering (Bachelor of Software Engineering)"

  let allPrograms = await fetch("static/uvic-calendar-data/all-programs.json");
  allPrograms = await allPrograms.json();
  const program = allPrograms[PROGRAM];
  const programReqs = program.requirements;
  // console.log(programReqs)

  
  let programCourses = await getProgramCourses(programReqs);
  // console.log(programCourses);

  for(let year in programCourses){
    for (let course in programCourses[year]){
      createCourseBlock( programCourses[year][course], year );
    }
  }

  const courseSessions = getCourseSessionsData();
  for(let courseName in courseSessions){
    const courseBlock = document.querySelector(`.course-block[data-course-name="${courseName}"]`);
    courseBlock.querySelectorAll('.section-btn').forEach(sessionBtn => {
      const session = sessionBtn.dataset.section;
      if (courseSessions[courseName].includes(session)){
        sessionBtn.dataset.selected = true;
      }
    });
  }

  generateSchedule();
}
init();


/**
 * gets all courses needed from program requirements, and returns array of the courses data
 * @param {*} programReqs 
 * @returns program courses data 
 */
async function getProgramCourses(programReqs){
  let allCourseData = await fetch("static/uvic-calendar-data/all-courses.json");
  allCourseData = await allCourseData.json();

  let programCoursesList = {}
  for (let year in programReqs){
    programCoursesList[year] = getDeepValues(programReqs[year]);
  }
  
  let programCourses = {};
  for (let year in programCoursesList){
    programCourses[year] = {};
    programCoursesList[year].forEach(course => {
      const courseData = allCourseData[course]
      if (courseData === undefined){ console.warn("could not find course in all-courses.json") }
      programCourses[year][course] = courseData;
    });
  }

  return programCourses
}

/**
 * returns list of courses from reqs by finding all strings in obj
 * https://stackoverflow.com/questions/42674473/get-all-keys-of-a-deep-object-in-javascript
 * @param {object} obj 
 */
 function getDeepValues(obj) {
  let values = [];
  for(let key in obj) {
      if(typeof obj[key] === "object") {
        let subvalues = getDeepValues(obj[key]);
        values.push( ...subvalues );
      } else {
        values.push( obj[key] );
      }
  }
  return values;
}


/** 
 * fill courses from list into schedule
 *  - fits all courses from list into schedule
 *  - considers restrictions (pre/co reqs, session offering)
 */
function generateSchedule(){
  console.log('running')
  // clear all schedule blocks except overridden ones
  document.querySelectorAll('.schedule-block').forEach( scheduleBlock => {scheduleBlock.remove()})

  // create all schedule blocks
  let all_scheduleBlocks = getAllScheduleBlocks();
  const all_terms = document.querySelectorAll(".term-block");

  all_terms.forEach(term => {
    let completedCourses = getCompletedCourses(term, "completed");
    let curTermCourses = getCompletedCourses(term, "concurrent");
    
    const maxCourseNum = parseInt( term.getAttribute("data-max-course-num") );
    const termSession = term.getAttribute("data-term-session");
    
    // console.log(completedCourses);
    // console.log(term);
    // console.log(all_scheduleBlocks.length);

    // fill term
    for (let i = 0; i < all_scheduleBlocks.length; i++){
      if ( term.querySelectorAll('.schedule-block').length >= maxCourseNum ) break;

      const scheduleBlock = all_scheduleBlocks[i];
      const hasSessionOffering = sessionOffered(scheduleBlock, termSession);
      if (!hasSessionOffering) continue;

      const meetsRequirements = meetsPrereqs(scheduleBlock, completedCourses, curTermCourses);
      if (!meetsRequirements) continue;

      if ( meetsRequirements && hasSessionOffering ){
        // add scheduleBlock to term
        addToTerm(scheduleBlock, term);
        curTermCourses.push(scheduleBlock.courseData.course_name);

        // restart and look through all courses again as concurrent has changed
        all_scheduleBlocks.splice( all_scheduleBlocks.indexOf(scheduleBlock) , 1);
        i = -1;
      }
    }
    
    // console.log(all_scheduleBlocks.length);
  });
}

function getCompletedCourses(term, which="completed"){
  let completedCourses = []
  document.querySelectorAll('.term-block .schedule-block').forEach(scheduleBlock => {
    const scheduleBlock_TermNum = parseInt(scheduleBlock.parentElement.dataset.termNum);
    const curTermNum =  parseInt(term.dataset.termNum);

    if (which === "completed" &&  scheduleBlock_TermNum < curTermNum ){
      completedCourses.push(scheduleBlock.courseData.course_name);
    }
    else if (which === "concurrent" &&  scheduleBlock_TermNum == curTermNum ){
      completedCourses.push(scheduleBlock.courseData.course_name);
    }

  });
  addAssumeCompleted(completedCourses);
  return completedCourses;
}

function addToTerm(scheduleBlock, term){
  term.appendChild(scheduleBlock);
}

function sessionOffered(scheduleBlock, session){
  const sessionOfferings = scheduleBlock.sessionOfferings;
  return ( sessionOfferings.includes(session) );
}

export function createScheduleBlock(courseData, sessionOfferings){ // export for testing
  const scheduleBlock = document.createElement('div');

  scheduleBlock.classList.add('schedule-block')
  scheduleBlock.innerHTML = courseData.course_name;
  scheduleBlock.courseData = courseData;
  scheduleBlock.sessionOfferings = sessionOfferings;
  addScheduleBlockListeners(scheduleBlock);

  return scheduleBlock;
}
function addScheduleBlockListeners(scheduleBlock){
  scheduleBlock.addEventListener("click", () => {
    console.log("clicked schedule block");
  });


}

function getAllScheduleBlocks(){
  let all_scheduleBlocks = [];

  const all_courses = document.querySelectorAll(".course-block");
  all_courses.forEach(course =>{
    const courseData = course.courseData;
    const sessionOfferings = getSessionOfferings(course);

    const scheduleBlock = createScheduleBlock(courseData, sessionOfferings);
    all_scheduleBlocks.push(scheduleBlock);
  });
  return all_scheduleBlocks;
}



//////////////////////////////////
//// TERM BLOCK IMPLEMENTATION////

// TODO - implement dynamic generation for year-containers
//  - motive: can create and remove years as needed
//  - use create year on init, within create year, create 3 term blocks
//  - add functions for create and remove year, min num years is 3

/**
 * Generate term blocks and set data on init
 * 
 * @param {number} num_termBlocks 
 */
function createTermBlock(num_termBlocks = 1){  
  for (let i = 0; i < num_termBlocks; i++){ 
    // create new term block - get from html template
    const termBlockTemplate = document.getElementById('term-block-template');
    const termBlock = termBlockTemplate.content.querySelector(".term-block").cloneNode(true);

    setTermBlockData(termBlock);

    // set term-session heading
    // console.log(termBlock)
    const termSession = termBlock.getAttribute('data-term-session');
    termBlock.querySelector('.term-session-heading').innerText = capitalize(termSession);

    // add term block to it's year container
    const termYear = termBlock.getAttribute('data-year');
    const container = document.querySelector(`.year-container[data-year='${termYear}'] .term-block-container`)
    container.appendChild(termBlock);

  }
}

/**
 * set term block attributes according to sequence
 * 
 * @param {object} termBlock 
 */

function setTermBlockData(termBlock){
  const termNumber = parseInt(document.querySelectorAll('.term-block').length);
  
  const termSessions = ['fall', 'spring', 'summer'];
  const termSession = termSessions[termNumber % 3]; // mod returns 0, 1, 2, (term 1 returns 1, term 3 returns 0, so summer term is 0th index)
  termBlock.setAttribute('data-term-session', termSession);
  termBlock.setAttribute('data-year', parseInt(termNumber/3) + 1); // truncate num plus 1 returns term year given amount of terms

  termBlock.setAttribute('data-term-type', 'study');
  termBlock.setAttribute('data-max-course-num', '6');
  termBlock.setAttribute('data-term-num', termNumber)
}


////////////////////////////////////
//// COURSE BLOCK IMPLEMENTATION////

/**
 * get course data through route /get_course
 *  - following https://stackoverflow.com/questions/59975596/connect-javascript-to-python-script-with-flask
 *  - returns json with detailed course title, prereqs, and url
 * 
 * @param {String} courseName (assume course name in form of BIOL307, BME250, ED-P251)
 */
async function getCourseData(courseName){
  let courseData = await fetch('/get_course?course_name='+courseName);
  courseData = await courseData.json();
  // console.log(courseData);

  return courseData
}

/**
 * get, validate, and format course name from input
 * @param {element} input 
 */
function getInputCourseName(input){
  // get course name from input
  let courseName = input.value;

  // validate course name - TODO, allow only alphanumeric and dash (-)
  if (courseName === ''){
    console.warn("Empty string exception");
    return 'invalid course name';
  }

  // format course name
  courseName = courseName.replace(/\s/g, ''); //remove spaces
  courseName = courseName.toUpperCase(); //set all caps

  return courseName;
}

/**
 * add course form submit listener
 * 
 * TODO - add implementation to prevent user from spamming add course
 */
const addCourseBtn = document.querySelector('.add-course-btn');
addCourseBtn.addEventListener('click', () => addNewCourse());
async function addNewCourse(){
  console.log('running add course listener');
  // add loading text
  const statusMsg = document.createElement('span');
  statusMsg.innerText = "Loading new course."
  addCourseBtn.parentNode.appendChild(statusMsg, null);

  // get course name from input
  const courseNameInput = document.getElementById("course-name");
  const courseName = getInputCourseName(courseNameInput);
  if (courseName === "invalid course name"){
    statusMsg.remove() // remove status
    return;
  };

  // get course data
  const courseData = await getCourseData(courseName);
  console.log(courseData)

  // create and add course block

  courseNameInput.value = '';
  statusMsg.remove() // remove status
}

/**
 * create course block functions
 * 
 * dynamically generates course block html
 */
function getCourseBlockTemplate(){
  return document.getElementById('course-block-template').content.querySelector('.course-block');
}
function createCourseBlock(courseData, year){
  const courseBlock = getCourseBlockTemplate().cloneNode(true);

  // append to associated year
  const container = document.querySelector(`.all-courses-container [data-year="${year}"]`);
  container.appendChild(courseBlock);

  //set pre reqs data
  courseBlock.courseData = courseData;

  //set frontend display data
  courseBlock.querySelector('.course-title').innerText = courseData.course_name || "Unnamed course";
  courseBlock.dataset.courseName = courseData.course_name || "Unnamed course";

  courseBlock.querySelector('.course-full-title').innerText = courseData.full_title || "";
  let courseReqs = courseData.requirements
  if ( courseReqs.length !== 0) courseReqs = JSON.stringify(courseReqs);
  else courseReqs = undefined;
  courseBlock.querySelector('.course-prereqs').innerText = courseReqs || "N/A";

  courseBlock.querySelector('.course-title').setAttribute("href", courseData.url)

  addCourseBlockListeners(courseBlock)
  return courseBlock;
}

function addCourseBlockListeners(courseBlock){
  const ddBtn = courseBlock.querySelector('.dd-btn');
  ddBtn.addEventListener("click", () => {
    const ddContainer = courseBlock.querySelector('.course-block .dd-expand-container');
    const open = !ddContainer.classList.contains("hidden-none");
    closeAllCourseExpanded();
    ddContainer.classList.toggle("hidden-none", open);
  });

  const termSessionBtns = courseBlock.querySelectorAll(".section-btn");
  termSessionBtns.forEach( sessionBtn => {
    sessionBtn.addEventListener("click", () => {
      sessionBtn.dataset.selected = !(sessionBtn.dataset.selected === 'true'); // toggle selected
      saveCourseSessionsData();
      generateSchedule();
    });
  });
}
function closeAllCourseExpanded(){
  document.querySelectorAll('.course-block .dd-expand-container').forEach(container => {
    container.classList.add("hidden-none");
  })
}

function getSessionOfferings(courseBlock){
  let sessionOfferings = [];
  courseBlock.querySelectorAll('.section-btn').forEach(section => {
    if ( section.dataset.selected === "true" ){
      sessionOfferings.push( section.dataset.section  );
    }
  });
  return sessionOfferings;
}





/**
 * save all courses data to session/local storage
 */
function saveCoursesData(){
  localStorage.setItem('coursesData', JSON.stringify(ALL_COURSES) );
}

function saveCourseSessionsData(){
  let sessionData = {};

  document.querySelectorAll('.course-block').forEach(course => {
    let sessions = [];
    course.querySelectorAll('.section-btn[data-selected="true"]').forEach(sectionBtn => {
      sessions.push( sectionBtn.dataset.section );
    });
    const courseName = course.courseData.course_name;
    sessionData[courseName] = sessions;
  });

  localStorage.setItem('courseSessions', JSON.stringify(sessionData) );
}
function getCourseSessionsData(){
  let courseSessions = localStorage.getItem('courseSessions');

  if (courseSessions !== null) courseSessions = JSON.parse(courseSessions);
  else courseSessions = {};
  
  return courseSessions;
}

/**
 * capitalize first letter of a string
 * @param {*} str 
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}