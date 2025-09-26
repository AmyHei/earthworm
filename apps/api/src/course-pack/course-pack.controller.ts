import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";

import { AuthGuard, UncheckAuth } from "../guards/auth.guard";
import { User, UserEntity } from "../user/user.decorators";
import { CoursePackService } from "./course-pack.service";

@Controller("course-pack")
export class CoursePackController {
  constructor(private readonly coursePackService: CoursePackService) {}

  @UncheckAuth()
  @UseGuards(AuthGuard)
  @Get()
  async findAll(@User() user: UserEntity) {
    return await this.coursePackService.findAll(user.userId);
  }

  @UncheckAuth()
  @UseGuards(AuthGuard)
  @Get("hierarchy")
  async getHierarchy() {
    return await this.coursePackService.getHierarchicalStructure();
  }

  @UncheckAuth()
  @UseGuards(AuthGuard)
  @Get("debug/all")
  async debugAll() {
    return await this.coursePackService.debugAllCoursePacks();
  }

  @UncheckAuth()
  @UseGuards(AuthGuard)
  @Get("textbook/:textbookId/grades")
  async getTextbookGrades(@Param("textbookId") textbookId: string) {
    return await this.coursePackService.findTextbookGrades(textbookId);
  }

  @UncheckAuth()
  @UseGuards(AuthGuard)
  @Get("grade/:gradeId/units")
  async getGradeUnits(@Param("gradeId") gradeId: string) {
    return await this.coursePackService.findGradeUnits(gradeId);
  }

  @UncheckAuth()
  @UseGuards(AuthGuard)
  @Get(":coursePackId")
  async findOne(@User() user: UserEntity, @Param("coursePackId") coursePackId: string) {
    return await this.coursePackService.findOneWithCourses(user.userId, coursePackId);
  }

  @UncheckAuth()
  @UseGuards(AuthGuard)
  @Get(":coursePackId/courses/:courseId")
  findCourse(
    @User() user: UserEntity,
    @Param("coursePackId") coursePackId: string,
    @Param("courseId") courseId: string,
  ) {
    return this.coursePackService.findCourse(user.userId, coursePackId, courseId);
  }

  @UncheckAuth()
  @UseGuards(AuthGuard)
  @Get(":coursePackId/courses/:courseId/next")
  findNextCourse(@Param("coursePackId") coursePackId: string, @Param("courseId") courseId: string) {
    return this.coursePackService.findNextCourse(coursePackId, courseId);
  }

  @UseGuards(AuthGuard)
  @Post(":coursePackId/courses/:courseId/complete")
  CompleteCourse(
    @User() user: UserEntity,
    @Param("coursePackId") coursePackId: string,
    @Param("courseId") courseId: string,
  ) {
    return this.coursePackService.completeCourse(user.userId, coursePackId, courseId);
  }
}
