let pvData = pv;
let htmlData = html;

let epiData = epi;
let ipsData = ips;

let getSpecification = () => {
  return "1.0.0";
};

//TODO check if medication has the text on it - in PT there is that info, for example - create ePI for it.
//TODO explore if could add also on top something if not there.
let annotationProcess = (listOfCategories, enhanceTag, document, response) => {
  listOfCategories.forEach((check) => {
    if (response.includes(check)) {
      let elements = document.getElementsByClassName(check);
      for (let i = 0; i < elements.length; i++) {
        elements[i].classList.add(enhanceTag);
        elements[i].classList.add("doping-lens");
      }
      if (document.getElementsByTagName("head").length > 0) {
        document.getElementsByTagName("head")[0].remove();
      }
      if (document.getElementsByTagName("body").length > 0) {
        response = document.getElementsByTagName("body")[0].innerHTML;
        console.log("Response: " + response);
      } else {
        console.log("Response: " + document.documentElement.innerHTML);
        response = document.documentElement.innerHTML;
      }
    }
  });

  if (response == null || response == "") {
    throw new Error(
      "Annotation proccess failed: Returned empty or null response"
    );
    //return htmlData
  } else {
    console.log("Response: " + response);
    return response;
  }
}


let annotateHTMLsection = async (listOfCategories, enhanceTag) => {
  let response = htmlData;
  let document;

  if (typeof window === "undefined") {
    let jsdom = await import("jsdom");
    let { JSDOM } = jsdom;
    let dom = new JSDOM(htmlData);
    document = dom.window.document;
    return annotationProcess(listOfCategories, enhanceTag, document, response);
  } else {
    document = window.document;
    return annotationProcess(listOfCategories, enhanceTag, document, response);
  }
};



let enhance = async () => {
  if (!ipsData || !ipsData.entry || ipsData.entry.length === 0) {
    throw new Error("IPS is empty or invalid.");
  }
  if (!epiData || !epiData.entry || epiData.entry.length === 0) {
    throw new Error("ePI is empty or invalid.");
  }
  let enhanceTag = "highlight";
  // Match lists
  const WADA_BUNDLE_IDENTIFIER_LIST = ["epibundle-123", "epibundle-abc"];
  const WADA_LIST = [
    "1115009", // Example: Testosterone
    "1234567", // Example: Erythropoietin (EPO)
    "204432",  // Example: Clenbuterol
    "360147"   // Example: Oxandrolone
  ];

  let listOfCategoriesToSearch = ["grav-2"]; //what to look in extension to find class
  // should we add the warning even without the class?? - see questionnaire lens

  let isProfessionalAthlete = false;
  let isProhibitedDrug = false;


  for (const entry of ipsData.entry) {
    const res = entry.resource;
    if (!res) continue;

    // 1. Check Patient extension
    if (res.resourceType === "Patient" && Array.isArray(res.extension)) {
      for (const ext of res.extension) {
        //console.log(ext.valueCodeableConcept.coding)
        if (
          ext.url === "http://hl7.org/fhir/StructureDefinition/individual-occupation" &&
          ext.valueCodeableConcept.coding[0].code == "3421" //Athletes and sports players"
          && ext.valueCodeableConcept.coding[0].system == "http://www.ilo.org/public/english/bureau/stat/isco"
        ) {
          isProfessionalAthlete = true;
          console.log("🏃‍♂️ Athlete status: professional");
        }
      }
    }
  };

  //search IPS to look it up as well
  ips.entry.forEach((entry) => {
    const resource = entry.resource;

    if (resource.resourceType === "Observation") {
      // Check if category contains the social-history code
      const hasSocialHistoryCategory = resource.category?.some(cat =>
        cat.coding?.some(coding =>
          coding.system === "http://terminology.hl7.org/CodeSystem/observation-category" &&
          coding.code === "social-history"
        )
      );

      // Check if code is 11341-5 (History of Occupation)
      const hasOccupationCode = resource.code?.coding?.some(coding =>
        coding.system === "http://loinc.org" &&
        coding.code === "11341-5"
      );

      // Check if valueCodeableConcept indicates athlete
      const hasAthleteValue = resource.valueCodeableConcept?.coding?.some(coding =>
        coding.system === "http://www.ilo.org/public/english/bureau/stat/isco" &&
        coding.code === "3421"
      );

      if (hasSocialHistoryCategory && hasOccupationCode && hasAthleteValue) {
        isProfessionalAthlete = true;
        console.log("Athlete status detected from Observation from persona vector:", resource.id);
      }
    }
  });

  // search persona vector to look it up as well
  const pvEntries = Array.isArray(pv?.entry) ? pv.entry : [];
  pvEntries.forEach((entry) => {
    const resource = entry.resource;

    if (resource.resourceType === "Observation") {
      // Check if category contains the social-history code
      const hasSocialHistoryCategory = resource.category?.some(cat =>
        cat.coding?.some(coding =>
          coding.system === "http://terminology.hl7.org/CodeSystem/observation-category" &&
          coding.code === "social-history"
        )
      );

      // Check if code is 11341-5 (History of Occupation)
      const hasOccupationCode = resource.code?.coding?.some(coding =>
        coding.system === "http://loinc.org" &&
        coding.code === "11341-5"
      );

      // Check if valueCodeableConcept indicates athlete
      const hasAthleteValue = resource.valueCodeableConcept?.coding?.some(coding =>
        coding.system === "http://www.ilo.org/public/english/bureau/stat/isco" &&
        coding.code === "3421"
      );

      if (hasSocialHistoryCategory && hasOccupationCode && hasAthleteValue) {
        isProfessionalAthlete = true;
        console.log("Athlete status detected from Observation from persona vector:", resource.id);
      }
    }
  });


  // 2. Check medications for doping substances
  // Check bundle.identifier.value
  if (
    epiData.identifier &&
    WADA_BUNDLE_IDENTIFIER_LIST.includes(epiData.identifier.value)
  ) {
    console.log("🔗 Matched ePI Doping Bundle.identifier:", epiData.identifier.value);
    isProhibitedDrug = true;
  }

  // Check MedicinalProductDefinition.identifier.value
  epiData.entry.forEach((entry) => {
    const res = entry.resource;
    if (res?.resourceType === "MedicinalProductDefinition") {
      const ids = res.identifier || [];
      ids.forEach((id) => {
        if (WADA_LIST.includes(id.value)) {
          console.log("💊 Matched Doping MedicinalProductDefinition.identifier:", id.value);
          isProhibitedDrug = true;
        }
      });
    }
  });


  // ePI traslation from terminology codes to their human redable translations in the sections
  let compositions = 0;
  let categories = [];
  epi.entry.forEach((entry) => {
    if (entry.resource.resourceType == "Composition") {
      compositions++;
      //Iterated through the Condition element searching for conditions
      entry.resource.extension.forEach((element) => {

        // Check if the position of the extension[1] is correct
        if (element.extension[1].url == "concept") {
          // Search through the different terminologies that may be avaible to check in the condition
          if (element.extension[1].valueCodeableReference.concept != undefined) {
            element.extension[1].valueCodeableReference.concept.coding.forEach(
              (coding) => {
                console.log("Extension: " + element.extension[0].valueString + ":" + coding.code)
                // Check if the code is in the list of categories to search
                if (listOfCategoriesToSearch.includes(coding.code)) {
                  // Check if the category is already in the list of categories
                  categories.push(element.extension[0].valueString);
                }
              }
            );
          }
        }
      });
    }
  });


  if (compositions == 0) {
    throw new Error('Bad ePI: no category "Composition" found');
  }

  if (categories.length == 0) {
    // throw new Error("No categories found", categories);
    return htmlData;
  }
  if (isProfessionalAthlete && isProhibitedDrug) {
    return await annotateHTMLsection(categories, enhanceTag);
  }
  else {

    console.warn("No doping risk condition met.");
    return htmlData;
  }

};


function getReport(lang) {
  console.log("Generating report in language:", lang);
  return { message: getExplanation(lang), status: "" };


}

// --- Get user-facing report sentence in the selected language ---
function getExplanation(lang) {
  console.log("Generating explanation in language:", lang);
  return "";
}

// --- Exported API ---
return {
  enhance: enhance,
  getSpecification: getSpecification,
  explanation: (language) => getExplanation(language || lang),
  report: (language) => getReport(language || lang),
};