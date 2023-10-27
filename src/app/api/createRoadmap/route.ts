import { NextRequest } from "next/server";
import { getSession, createResponse } from "@/lib/session"
import prisma from "@/prismaClient";
import { AccessLevel, GoalInput, RoadmapInput } from "@/types";
import roadmapGoalCreator from "./roadmapGoalCreator";
import accessChecker from "@/lib/accessChecker";

export async function POST(request: NextRequest) {
  const response = new Response();
  const session = await getSession(request, response);

  let roadmap: RoadmapInput & { goals?: GoalInput[] } = await request.json();

  // Validate request body
  if (!roadmap.name || (!roadmap.county && !roadmap.isNational)) {
    return createResponse(
      response,
      JSON.stringify({ message: 'Missing required input parameters' }),
      { status: 400 }
    );
  }

  // Validate session
  if (!session.user?.isLoggedIn) {
    return createResponse(
      response,
      JSON.stringify({ message: 'Unauthorized' }),
      { status: 401 }
    );
  }

  // Only admins can create national roadmaps
  if (roadmap.isNational && !session.user?.isAdmin) {
    return createResponse(
      response,
      JSON.stringify({ message: 'Forbidden; only admins can create national roadmaps' }),
      { status: 403 }
    );
  }

  // Create lists of UUIDs for linking
  let editors: { username: string }[] = [];
  for (let name of roadmap.editors || []) {
    editors.push({ username: name });
  }

  let viewers: { username: string }[] = [];
  for (let name of roadmap.viewers || []) {
    viewers.push({ username: name });
  }

  let editGroups: { name: string }[] = [];
  for (let name of roadmap.editGroups || []) {
    editGroups.push({ name: name });
  }

  let viewGroups: { name: string }[] = [];
  for (let name of roadmap.viewGroups || []) {
    viewGroups.push({ name: name });
  }

  // Create the roadmap
  try {
    let newRoadmap = await prisma.roadmap.create({
      data: {
        name: roadmap.name,
        isNational: roadmap.isNational,
        county: roadmap.county,
        municipality: roadmap.municipality,
        author: { connect: { id: session.user.id } },
        editors: { connect: editors },
        viewers: { connect: viewers },
        editGroups: { connect: editGroups },
        viewGroups: { connect: viewGroups },
        goals: {
          create: roadmapGoalCreator(roadmap, session.user.id, editors, viewers, editGroups, viewGroups),
        },
      },
    });
    // Return the new roadmap's ID if successful
    return createResponse(
      response,
      JSON.stringify({ message: "Roadmap created", id: newRoadmap.id }),
      { status: 200 }
    );
  } catch (e: any) {
    console.log(e);
    // Custom error if there are errors in the nested goal creation
    if (e instanceof Error) {
      e = e as Error
      if (e.cause == 'nestedGoalCreation') {
        return createResponse(
          response,
          JSON.stringify({ message: e.message }),
          { status: 400 }
        );
      }
    }
    return createResponse(
      response,
      JSON.stringify({ message: "Internal server error" }),
      { status: 500 }
    );
  }

  // If we get here, something went wrong
  return createResponse(
    response,
    JSON.stringify({ message: "Internal server error" }),
    { status: 500 }
  );
}

export async function PUT(request: NextRequest) {
  const response = new Response();
  const session = await getSession(request, response);

  let roadmap: RoadmapInput & { goals?: GoalInput[], roadmapId: string } = await request.json();

  // Validate request body
  if (!roadmap.roadmapId || !roadmap.name || (!roadmap.county && !roadmap.isNational)) {
    return createResponse(
      response,
      JSON.stringify({ message: 'Missing required input parameters' }),
      { status: 400 }
    );
  }

  // Validate session
  try {
    let access: AccessLevel = AccessLevel.None;
    let currentRoadmap = await prisma.roadmap.findUnique({
      where: { id: roadmap.roadmapId },
      include: {
        author: { select: { id: true, username: true } },
        editors: { select: { id: true, username: true } },
        viewers: { select: { id: true, username: true } },
        editGroups: { include: { users: { select: { id: true, username: true } } } },
        viewGroups: { include: { users: { select: { id: true, username: true } } } },
      }
    });
    access = accessChecker(currentRoadmap!, session.user)
    if (access === AccessLevel.None || access === AccessLevel.View) {
      throw new Error('Access denied');
    }
  } catch (e) {
    console.log(e);
    return createResponse(
      response,
      JSON.stringify({ message: "You either don't have access to this roadmap or are trying to edit a roadmap that doesn't exist" }),
      { status: 403 }
    );
  }

  // Only admins can create national roadmaps
  if (roadmap.isNational && !session.user?.isAdmin) {
    return createResponse(
      response,
      JSON.stringify({ message: 'Forbidden; only admins can create national roadmaps' }),
      { status: 403 }
    );
  }

  // Create lists of UUIDs for linking
  let editors: { username: string }[] = [];
  for (let name of roadmap.editors || []) {
    editors.push({ username: name });
  }

  let viewers: { username: string }[] = [];
  for (let name of roadmap.viewers || []) {
    viewers.push({ username: name });
  }

  let editGroups: { name: string }[] = [];
  for (let name of roadmap.editGroups || []) {
    editGroups.push({ name: name });
  }

  let viewGroups: { name: string }[] = [];
  for (let name of roadmap.viewGroups || []) {
    viewGroups.push({ name: name });
  }

  // Update the roadmap
  try {
    let updatedRoadmap = await prisma.roadmap.update({
      where: { id: roadmap.roadmapId },
      data: {
        name: roadmap.name,
        isNational: roadmap.isNational,
        county: roadmap.county,
        municipality: roadmap.municipality,
        editors: { set: editors },
        viewers: { set: viewers },
        editGroups: { set: editGroups },
        viewGroups: { set: viewGroups },
        goals: {
          create: roadmapGoalCreator(roadmap, session.user!.id, editors, viewers, editGroups, viewGroups),
        }
      },
    });
    // Return the new roadmap's ID if successful
    return createResponse(
      response,
      JSON.stringify({ message: "Roadmap updated", id: updatedRoadmap.id }),
      { status: 200 }
    );
  } catch (e: any) {
    console.log(e);
    return createResponse(
      response,
      JSON.stringify({ message: "Internal server error" }),
      { status: 500 }
    );
  }

  // If we get here, something went wrong
  return createResponse(
    response,
    JSON.stringify({ message: "Internal server error" }),
    { status: 500 }
  );
}