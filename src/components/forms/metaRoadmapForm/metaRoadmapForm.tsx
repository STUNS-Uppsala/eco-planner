'use client'

import countiesAndMunicipalities from "@/lib/countiesAndMunicipalities.json" with { type: "json" }
import { Data } from "@/lib/session";
import { AccessControlled, MetaRoadmapInput } from "@/types";
import { MetaRoadmap, RoadmapType } from "@prisma/client";
import { useEffect, useState } from "react";
import AccessSelector, { getAccessData } from "@/components/forms/accessSelector/accessSelector";
import LinkInput, { getLinks } from "@/components/forms/linkInput/linkInput"
import formSubmitter from "@/functions/formSubmitter";
import styles from '../forms.module.css'
import Image from "next/image";

export default function MetaRoadmapForm({
  user,
  userGroups,
  parentRoadmapOptions,
  currentRoadmap,
}: {
  user: Data['user'],
  userGroups: string[],
  parentRoadmapOptions?: MetaRoadmap[],
  currentRoadmap?: MetaRoadmap & AccessControlled,
}) {
  async function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    // Mostly the usual submit handler stuff.
    // We might want to redirect the user to the roadmap form immediately after successfully submitting the metaRoadmap form
    // (and pre-populate the roadmap form with the new metaRoadmap's ID)
    event.preventDefault();
    // Prevent double submission
    if (isLoading) return;
    setIsLoading(true);

    const form = event.target.elements;

    const links = getLinks(event.target);

    const { editUsers, viewUsers, editGroups, viewGroups } = getAccessData(
      form.namedItem("editUsers"),
      form.namedItem("viewUsers"),
      form.namedItem("editGroups"),
      form.namedItem("viewGroups")
    );

    const formData: MetaRoadmapInput & { id?: string, timestamp?: number } = {
      name: (form.namedItem("metaRoadmapName") as HTMLInputElement)?.value,
      description: (form.namedItem("description") as HTMLTextAreaElement)?.value,
      type: ((form.namedItem("type") as HTMLSelectElement)?.value as RoadmapType) || null,
      actor: (form.namedItem("actor") as HTMLInputElement)?.value || null,
      editors: editUsers,
      viewers: viewUsers,
      editGroups,
      viewGroups,
      links,
      parentRoadmapId: (form.namedItem("parentRoadmap") as HTMLSelectElement)?.value || undefined,
      id: currentRoadmap?.id || undefined,
      timestamp,
    };

    const formJSON = JSON.stringify(formData);

    formSubmitter('/api/metaRoadmap', formJSON, currentRoadmap ? 'PUT' : 'POST', setIsLoading);
  }

  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [transformIndex, setTransformIndex] = useState(0)

  const timestamp = Date.now()

  const customRoadmapTypes = {
    [RoadmapType.NATIONAL]: 'Nationell färdplan',
    [RoadmapType.REGIONAL]: 'Regional färdplan',
    [RoadmapType.MUNICIPAL]: 'Kommunal färdplan',
    [RoadmapType.LOCAL]: 'Lokal färdplan',
    [RoadmapType.OTHER]: 'Övrig färdplan, exempelvis för en organisation'
  }

  let currentAccess: AccessControlled | undefined = undefined;
  if (currentRoadmap) {
    currentAccess = {
      author: currentRoadmap.author,
      editors: currentRoadmap.editors,
      viewers: currentRoadmap.viewers,
      editGroups: currentRoadmap.editGroups,
      viewGroups: currentRoadmap.viewGroups,
    }
  }

  function iterateSections(options?: { reverse?: boolean }) {
    const sectionsParent = document?.getElementById('form-sections')
    const sections = Array.from(sectionsParent?.children || [])
    const currentIndicator = document?.getElementById('current-indicator')
    const indicatorsParent = document?.getElementById('indicators')
    const indicators = Array.from(indicatorsParent?.children || [])
    const submitButton = document?.getElementById('submit-button')

    const currentTransformIndex = transformIndex + (options?.reverse ? -1 : 1)

    if ((currentTransformIndex >= sections.length && !options?.reverse) || (currentTransformIndex < 0 && options?.reverse)) {
      return
    }

    sections.forEach(element => {
      const transformData = (element as HTMLElement).dataset.transform
      if (transformData) {
        const test = parseInt(transformData);

        if (options?.reverse) {
          (element as HTMLElement).dataset.transform = (test + 100).toString();
        } else {
          (element as HTMLElement).dataset.transform = (test - 100).toString();
        }

        const datasetTransform = (element as HTMLElement).dataset.transform;
        (element as HTMLElement).style.transform = `translate(${datasetTransform}%, 0)`
      }
    })

    // Turn indicators green if they are complete
    for (let i = 0; i < indicators.length; i++) {
      if (i < currentTransformIndex) {
        (indicators[i] as HTMLElement).style.backgroundColor = 'seagreen'
      } else {
        (indicators[i] as HTMLElement).style.backgroundColor = 'var(--gray-90)'
      }
    }

    if (currentIndicator) {
      currentIndicator.style.transform = `translate(${(250 * currentTransformIndex) + 50}%, 0)`
    }

    // Enable submitbutton if on final step
    if(submitButton) {
      if (currentTransformIndex == sections.length - 1) {
        submitButton.removeAttribute('disabled')
      } else {
        submitButton.setAttribute('disabled', 'true')
      }
    }

    setTransformIndex(currentTransformIndex)

  }

  return (
    <>
      <form onSubmit={handleSubmit} >
        {/* This hidden submit button prevents submitting by pressing enter, this avoids accidental submission when adding new entries in AccessSelector (for example, when pressing enter to add someone to the list of editors) */}
        <input type="submit" disabled={true} style={{ display: 'none' }} aria-hidden={true} />

        <div id="form-sections" className={styles.formSlider}>
          <section className="width-100" data-transform="0">
            <h2>Beskriv din färdplan</h2>
            <label className="block margin-y-75">
              Namn för den nya färdplanen
              <input id="metaRoadmapName" name="metaRoadmapName" className="margin-y-25" type="text" defaultValue={currentRoadmap?.name ?? undefined} required />
            </label>

            <label className="block margin-y-75">
              Beskrivning av färdplanen
              <textarea className="block smooth margin-y-25" name="description" id="description" defaultValue={currentRoadmap?.description ?? undefined} required></textarea>
            </label>
          </section>

          <section className="width-100" data-transform="0">
            <h2>Vem ansvarar för den här färdplanen?</h2>
            <label className="block margin-y-75">
              Typ av färdplan
              <select className="block margin-y-25" name="type" id="type" defaultValue={currentRoadmap?.type ?? ""} required>
                <option value="">Välj en typ</option>
                {
                  Object.values(RoadmapType).map((value) => {
                    if (value == RoadmapType.NATIONAL && !user?.isAdmin) return null;
                    return (
                      <option key={value} value={value}>{value in customRoadmapTypes ? customRoadmapTypes[value] : value}</option>
                    )
                  })
                }
              </select>
            </label>

            <label className="block margin-y-75">
              Aktör för färdplanen
              <input className="margin-y-25" list="actors" id="actor" name="actor" type="text" defaultValue={currentRoadmap?.actor ?? undefined} />
            </label>
          </section>

          <section className="width-100" data-transform="0">
            <h2>Är färdplanen beroende av några externa resurser?</h2>
            <LinkInput />
          </section>

          { // Only show the access selector if a new roadmap is being created, the user is an admin, or the user is the author of the roadmap
            (!currentRoadmap || user?.isAdmin || user?.id === currentRoadmap.authorId) &&
            <section data-transform="0">
              <h2>Vem ska ha tillgång till din färdplan?</h2>
              <AccessSelector groupOptions={userGroups} currentAccess={currentAccess} />
            </section>
          }

          <section className="width-100" data-transform="0">
            <h2>Jobbar denna färdplan mot en annan färdplan?</h2>
            <label className="block margin-y-75">
              Om denna färdplan har en annan färdplan den jobbar mot kan den väljas här
              <select name="parentRoadmap" id="parentRoadmap" className="block margin-y-25" defaultValue={currentRoadmap?.parentRoadmapId ?? ""}>
                <option value="">Ingen förälder vald</option>
                {
                  !parentRoadmapOptions && currentRoadmap && currentRoadmap.parentRoadmapId && (
                    <option value={currentRoadmap.parentRoadmapId} disabled>{currentRoadmap.parentRoadmapId}</option>
                  )
                }
                {
                  parentRoadmapOptions && parentRoadmapOptions.map((roadmap) => {
                    return (
                      <option key={roadmap.id} value={roadmap.id}>{roadmap.name}</option>
                    )
                  })
                }
              </select>
            </label>
          </section>
        </div>

        <div className="margin-y-100 padding-x-100 display-flex align-items-flex-start justify-content-space-between gap-100">
          
          <button type="button" className="flex align-items-center transparent round gap-25" style={{fontSize: '1rem'}} onClick={() => iterateSections({ reverse: true })}>
            <Image src="/icons/arrowLeft.svg" alt="" width={24} height={24} />
            Tillbaka 
          </button>

          <div className="margin-y-50" style={{ marginInline: 'auto', width: 'fit-content' }}>
            <div id="indicators" className="display-flex justify-content-center gap-75 margin-y-50">
              <div className={styles.indicator}></div>
              <div className={styles.indicator}></div>
              <div className={styles.indicator}></div>
              <div className={styles.indicator}></div>
              <div className={styles.indicator}></div>
            </div>
            <div className={styles.currentIndicator} id="current-indicator"></div>
          </div>

          <button type="button" className="flex align-items-center transparent round gap-25" style={{fontSize: '1rem'}} onClick={() => iterateSections()}>
            Nästa
            <Image src="/icons/arrowRight.svg" alt="" width={24} height={24} />
          </button>

        </div>

        {/* Add copy of RoadmapForm? Only if we decide to include it immediately rather than redirecting to it */}

        <button type="submit" id="submit-button" value={currentRoadmap ? "Spara" : "Skapa färdplan"} disabled 
                className={`${styles.submitButton} seagreen color-purewhite round block`} style={{marginInline: 'auto', width: 'min(25ch, 100%)', fontSize: '1rem'}}>
          {currentRoadmap ? "Spara" : "Skapa färdplan"}
        </button>

      </form>

      <datalist id="actors">
        {
          Object.entries(countiesAndMunicipalities).flat(2).map((actor, index) => {
            return (
              <option key={`${actor}${index}`} value={actor} />
            )
          })
        }
      </datalist>
    </>
  )
}