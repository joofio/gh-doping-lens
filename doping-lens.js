let htmlData = html;
let ipsData = ips;

let getSpecification = () => {
    return "1.0.0";
};

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
    let enhanceTag = "highlight";
    const WADA_LIST = [
        "1115009", // Example: Testosterone
        "1234567", // Example: Erythropoietin (EPO)
        "204432",  // Example: Clenbuterol
        "360147"   // Example: Oxandrolone
      ];
      let listOfCategoriesToSearch = ["grav-2"]; //what to look in extension to find class

      let isProfessionalAthlete = false;
      let takingProhibitedDrug = false;
    
      // Index medications by reference
      const medicationsById = new Map();
      ipsData.entry.forEach((entry) => {
        if (entry.resource?.resourceType === "Medication" && entry.resource.id) {
          medicationsById.set(`Medication/${entry.resource.id}`, entry.resource);
        }
      });
    
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
            ) {
              isProfessionalAthlete = true;
              console.log("🏃‍♂️ Athlete status: professional");
            }
          }
        }
    
        // 2. Check medications for doping substances
        if (
          ["MedicationStatement", "MedicationRequest"].includes(res.resourceType)
        ) {
          let codes = [];
    
          if (res.medicationCodeableConcept?.coding) {
            codes = res.medicationCodeableConcept.coding;
          }
    
          if (res.medicationReference?.reference) {
            const medRef = res.medicationReference.reference;
            const med = medicationsById.get(medRef);
            if (med?.code?.coding) {
              codes = codes.concat(med.code.coding);
            }
          }
    
          for (const coding of codes) {
            if (WADA_LIST.includes(coding.code)) {
              takingProhibitedDrug = true;
              console.log("🚫 Doping substance found:", coding.code);
              break;
            }
          }
        }
      }


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
    if (isProfessionalAthlete && takingProhibitedDrug) {
        return await annotateHTMLsection(categories, enhanceTag);
    }
    else {

        console.warn("No doping risk condition met.");
        return htmlData;
    }

};

return {
    enhance: enhance,
    getSpecification: getSpecification,
};
