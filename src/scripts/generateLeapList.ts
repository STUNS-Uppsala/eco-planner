import fs from 'fs';
import prisma from '../prismaClient.ts'
import { RoadmapType } from '@prisma/client';
/**
 * This script generates a json file containing all indicator parameters from public, national roadmaps.
 * The file is used to generate suggestions for indicator parameters when creating a new goal.
 * The output is saved in src/lib/LEAPList.json
 */
async function generateLeapList() {
  // Get the indicator parameters
  let rawData = await prisma.roadmap.findMany({
    where: {
      metaRoadmap: { type: RoadmapType.NATIONAL },
      viewGroups: { some: { name: 'public' } },
    },
    select: {
      goals: {
        select: {
          indicatorParameter: true,
        },
      },
    },
  }).catch((err) => { });

  if (rawData?.length === 0 || !rawData) {
    console.log("No public, national roadmaps found; LEAP list not touched.")
    return
  }

  // Flatten the data
  let leapList = [];
  for (let roadmap of rawData) {
    for (let goal of roadmap.goals) {
      leapList.push(goal.indicatorParameter);
    }
  }

  // Remove duplicates and sort
  leapList = leapList.filter((value, index, self) => self.indexOf(value) === index);
  leapList.sort();

  // Write to file
  fs.writeFile('src/lib/LEAPList.json', JSON.stringify(leapList), (err) => {
    if (err) throw err;
    console.log('The file has been saved!');
  });
}

generateLeapList();